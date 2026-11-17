import type {
  AutomaticReloadPaymentRequest,
  DeferredPaymentRequest,
  PaymentRequest,
  RecurringPaymentRequest,
} from '../../types'
import { normalizePaymentRequest } from '../paymentRequest'

const DAY = 24 * 60 * 60 * 1000
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY)

const request = (fields: Partial<PaymentRequest>): PaymentRequest => ({
  countryCode: 'US',
  currencyCode: 'USD',
  paymentItems: [],
  supportedNetworks: ['visa'],
  merchantCapabilities: ['3DS'],
  ...fields,
})

const base = {
  description: 'Premium membership',
  managementUrl: 'https://example.com/account',
}

const recurring = (
  fields: Partial<RecurringPaymentRequest> = {}
): RecurringPaymentRequest => ({
  ...base,
  regularBilling: { label: 'Monthly', amount: 9.99, intervalUnit: 'month' },
  ...fields,
})

const deferred = (
  fields: Partial<DeferredPaymentRequest> = {}
): DeferredPaymentRequest => ({
  ...base,
  deferredBilling: { label: 'Hotel', amount: 240, date: daysFromNow(30) },
  ...fields,
})

const automaticReload = (
  fields: Partial<AutomaticReloadPaymentRequest> = {}
): AutomaticReloadPaymentRequest => ({
  ...base,
  automaticReloadBilling: {
    label: 'Top-up',
    amount: 25,
    thresholdAmount: 5,
  },
  ...fields,
})

const expectInvalid = (fields: Partial<PaymentRequest>, message: string) =>
  expect(() => normalizePaymentRequest(request(fields))).toThrow(message)

describe('normalizePaymentRequest with merchant tokens', () => {
  it('normalizes the amounts and keeps the dates', () => {
    const trialEnd = daysFromNow(7)
    const result = normalizePaymentRequest(
      request({
        recurring: recurring({
          trialBilling: {
            label: 'Trial',
            amount: 0,
            intervalUnit: 'day',
            intervalCount: 7,
            endDate: trialEnd,
          },
        }),
      })
    )

    expect(result.recurring?.regularBilling.amount).toBe('9.99')
    expect(result.recurring?.trialBilling?.amount).toBe('0.00')
    expect(result.recurring?.trialBilling?.endDate).toBe(trialEnd)
  })

  it('normalizes deferred and automatic reload amounts', () => {
    expect(
      normalizePaymentRequest(request({ deferred: deferred() })).deferred
        ?.deferredBilling.amount
    ).toBe('240.00')
    const billing = normalizePaymentRequest(
      request({ automaticReload: automaticReload() })
    ).automaticReload?.automaticReloadBilling
    expect(billing?.amount).toBe('25.00')
    expect(billing?.thresholdAmount).toBe('5.00')
  })

  it('leaves a request without them unchanged', () => {
    const result = normalizePaymentRequest(request({}))
    expect(result).not.toHaveProperty('recurring')
    expect(result).not.toHaveProperty('deferred')
    expect(result).not.toHaveProperty('automaticReload')
  })

  it('allows only one of them', () => {
    expectInvalid(
      { recurring: recurring(), deferred: deferred() },
      'Set at most one of recurring, deferred and automaticReload'
    )
  })

  describe('shared fields', () => {
    it('needs a description', () => {
      expectInvalid(
        { recurring: recurring({ description: ' ' }) },
        'recurring.description must not be empty'
      )
    })

    it.each([
      'http://example.com/account',
      'https://example.com/account/',
      'https://example.com/',
      'https://example.com/account?user=42',
      'https://example.com/account#billing',
      'example.com/account',
    ])('rejects the management URL %s', (managementUrl) => {
      expectInvalid(
        { recurring: recurring({ managementUrl }) },
        'recurring.managementUrl must be an https URL without query, fragment or trailing slash'
      )
    })

    it('accepts a bare origin', () => {
      expect(() =>
        normalizePaymentRequest(
          request({
            recurring: recurring({ managementUrl: 'https://example.com' }),
          })
        )
      ).not.toThrow()
    })

    it('checks the token notification URL', () => {
      expectInvalid(
        {
          deferred: deferred({
            tokenNotificationUrl: 'https://example.com/hook/',
          }),
        },
        'deferred.tokenNotificationUrl must be an https URL'
      )
    })

    it('limits the billing agreement to 300 characters', () => {
      expectInvalid(
        {
          automaticReload: automaticReload({
            billingAgreement: 'x'.repeat(301),
          }),
        },
        'automaticReload.billingAgreement must be at most 300 characters, got 301'
      )
    })
  })

  describe('recurring', () => {
    it.each([0, -1])('needs a positive regular amount, not %s', (amount) => {
      expectInvalid(
        {
          recurring: recurring({
            regularBilling: { label: 'Monthly', amount, intervalUnit: 'month' },
          }),
        },
        'Amount for "Monthly" must be positive'
      )
    })

    it('rejects an unknown interval unit', () => {
      expectInvalid(
        {
          recurring: recurring({
            regularBilling: {
              label: 'Monthly',
              amount: 9.99,
              intervalUnit: 'week' as 'day',
            },
          }),
        },
        'recurring.regularBilling.intervalUnit must be one of day, month, year, got "week"'
      )
    })

    it.each([0, 1.5, -2, 2_147_483_648, 1e20])(
      'rejects the interval count %s',
      (intervalCount) => {
        expectInvalid(
          {
            recurring: recurring({
              regularBilling: {
                label: 'Monthly',
                amount: 9.99,
                intervalUnit: 'month',
                intervalCount,
              },
            }),
          },
          'recurring.regularBilling.intervalCount must be a positive integer'
        )
      }
    )

    it('accepts the largest interval count', () => {
      expect(() =>
        normalizePaymentRequest(
          request({
            recurring: recurring({
              regularBilling: {
                label: 'Monthly',
                amount: 9.99,
                intervalUnit: 'day',
                intervalCount: 2_147_483_647,
              },
            }),
          })
        )
      ).not.toThrow()
    })

    it('limits a label to 100 characters', () => {
      expectInvalid(
        {
          recurring: recurring({
            regularBilling: {
              label: 'x'.repeat(101),
              amount: 9.99,
              intervalUnit: 'month',
            },
          }),
        },
        'recurring.regularBilling.label must be at most 100 characters'
      )
    })

    it('needs future dates in order', () => {
      expectInvalid(
        {
          recurring: recurring({
            regularBilling: {
              label: 'Monthly',
              amount: 9.99,
              intervalUnit: 'month',
              startDate: daysFromNow(-1),
            },
          }),
        },
        'recurring.regularBilling.startDate must be in the future'
      )
      expectInvalid(
        {
          recurring: recurring({
            regularBilling: {
              label: 'Monthly',
              amount: 9.99,
              intervalUnit: 'month',
              startDate: daysFromNow(10),
              endDate: daysFromNow(5),
            },
          }),
        },
        'recurring.regularBilling.startDate must be before its endDate'
      )
    })

    it('rejects an invalid Date', () => {
      expectInvalid(
        {
          recurring: recurring({
            regularBilling: {
              label: 'Monthly',
              amount: 9.99,
              intervalUnit: 'month',
              endDate: new Date('not a date'),
            },
          }),
        },
        'recurring.regularBilling.endDate must be a valid Date'
      )
    })

    it('needs a trial end date', () => {
      expectInvalid(
        {
          recurring: recurring({
            trialBilling: { label: 'Trial', amount: 0, intervalUnit: 'day' },
          }),
        },
        'recurring.trialBilling.endDate is required'
      )
    })

    it('rejects a negative trial amount', () => {
      expectInvalid(
        {
          recurring: recurring({
            trialBilling: {
              label: 'Trial',
              amount: -1,
              intervalUnit: 'day',
              endDate: daysFromNow(7),
            },
          }),
        },
        'Amount for "Trial" must not be negative'
      )
    })

    it('ends the regular phase after it starts, at the end of the trial', () => {
      expectInvalid(
        {
          recurring: recurring({
            trialBilling: {
              label: 'Trial',
              amount: 0,
              intervalUnit: 'day',
              endDate: daysFromNow(7),
            },
            regularBilling: {
              label: 'Monthly',
              amount: 9.99,
              intervalUnit: 'month',
              endDate: daysFromNow(5),
            },
          }),
        },
        'recurring.regularBilling.endDate must be after recurring.trialBilling.endDate, when the regular phase starts'
      )
    })

    it('starts the regular phase no earlier than the trial ends', () => {
      expectInvalid(
        {
          recurring: recurring({
            trialBilling: {
              label: 'Trial',
              amount: 0,
              intervalUnit: 'day',
              endDate: daysFromNow(7),
            },
            regularBilling: {
              label: 'Monthly',
              amount: 9.99,
              intervalUnit: 'month',
              startDate: daysFromNow(6),
            },
          }),
        },
        'recurring.regularBilling.startDate must not be before recurring.trialBilling.endDate'
      )
    })
  })

  describe('deferred', () => {
    it('needs a positive amount', () => {
      expectInvalid(
        {
          deferred: deferred({
            deferredBilling: {
              label: 'Hotel',
              amount: 0,
              date: daysFromNow(30),
            },
          }),
        },
        'Amount for "Hotel" must be positive'
      )
    })

    it('needs a future date', () => {
      expectInvalid(
        {
          deferred: deferred({
            deferredBilling: { label: 'Hotel', amount: 240, date: new Date() },
          }),
        },
        'deferred.deferredBilling.date must be in the future'
      )
    })

    it('checks the free cancellation', () => {
      expectInvalid(
        {
          deferred: deferred({
            freeCancellation: {
              date: daysFromNow(-1),
              timeZone: 'Europe/Warsaw',
            },
          }),
        },
        'deferred.freeCancellation.date must be in the future'
      )
      expectInvalid(
        {
          deferred: deferred({
            freeCancellation: { date: daysFromNow(28), timeZone: '' },
          }),
        },
        'deferred.freeCancellation.timeZone must not be empty'
      )
    })
  })

  describe('automaticReload', () => {
    it('needs a positive reload amount', () => {
      expectInvalid(
        {
          automaticReload: automaticReload({
            automaticReloadBilling: {
              label: 'Top-up',
              amount: 0,
              thresholdAmount: 5,
            },
          }),
        },
        'Amount for "Top-up" must be positive'
      )
    })

    it('allows a zero threshold but not a negative one', () => {
      expect(() =>
        normalizePaymentRequest(
          request({
            automaticReload: automaticReload({
              automaticReloadBilling: {
                label: 'Top-up',
                amount: 25,
                thresholdAmount: 0,
              },
            }),
          })
        )
      ).not.toThrow()
      expectInvalid(
        {
          automaticReload: automaticReload({
            automaticReloadBilling: {
              label: 'Top-up',
              amount: 25,
              thresholdAmount: -5,
            },
          }),
        },
        'Amount for "Top-up threshold" must not be negative'
      )
    })

    it('reports an amount with too many decimal places', () => {
      expectInvalid(
        {
          automaticReload: automaticReload({
            automaticReloadBilling: {
              label: 'Top-up',
              amount: '25.001',
              thresholdAmount: 5,
            },
          }),
        },
        'Amount for "Top-up" has more than 2 decimal places'
      )
    })
  })
})
