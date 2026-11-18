import { PaymentError } from '../errors'

describe('PaymentError', () => {
  it('is an Error with a name, a code and a message', () => {
    const error = new PaymentError('Cart is empty', 'CONFIGURATION')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(PaymentError)
    expect(error.name).toBe('PaymentError')
    expect(error.code).toBe('CONFIGURATION')
    expect(error.message).toBe('Cart is empty')
    expect(error).not.toHaveProperty('cause')
  })

  it('keeps the cause', () => {
    const cause = new Error('Amount must not be negative')
    const error = new PaymentError(cause.message, 'CONFIGURATION', { cause })

    expect(error.cause).toBe(cause)
  })
})
