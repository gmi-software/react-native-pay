import type { ReactNode } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import HomepageFeatures from "@site/src/components/HomepageFeatures";

import styles from "./index.module.css";

function HomepageHeader() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx("hero", styles.heroBanner)}>
      <div className={styles.heroBackground}>
        <div className={styles.heroGlow1} />
        <div className={styles.heroGlow2} />
      </div>
      <div className={clsx("container", styles.heroContainer)}>
        <div className={styles.badge}>
          <span>Native Payments Simplified</span>
        </div>
        <h1 className={styles.heroTitle}>
          React Native <span className={styles.heroTitleHighlight}>Pay</span>
        </h1>
        <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/quick-start"
          >
            Quick Start
          </Link>
          <Link
            className="button button--outline button--lg"
            to="/docs/api/use-payment-checkout"
          >
            API Reference
          </Link>
        </div>
        <div className={styles.terminalContainer}>
          <div className={styles.terminalHeader}>
            <div
              className={styles.terminalDot}
              style={{ background: "#ff5f56" }}
            />
            <div
              className={styles.terminalDot}
              style={{ background: "#ffbd2e" }}
            />
            <div
              className={styles.terminalDot}
              style={{ background: "#27c93f" }}
            />
          </div>
          <div className={styles.terminalBody}>
            <code>
              <span className={styles.terminalKeyword}>import</span> {"{"}{" "}
              usePaymentCheckout {"}"}{" "}
              <span className={styles.terminalKeyword}>from</span>{" "}
              <span className={styles.terminalString}>
                '@gmisoftware/react-native-pay'
              </span>
              ;
              <br />
              <br />
              <span className={styles.terminalKeyword}>const</span> {"{"}{" "}
              addItem, startPayment {"}"} ={" "}
              <span className={styles.terminalFunction}>
                usePaymentCheckout
              </span>
              ({"{"}
              <br />
              &nbsp;&nbsp;currencyCode:{" "}
              <span className={styles.terminalString}>'USD'</span>
              ,<br />
              &nbsp;&nbsp;countryCode:{" "}
              <span className={styles.terminalString}>'US'</span>
              <br />
              {"}"});
              <br />
              <span className={styles.terminalFunction}>addItem</span>(
              <span className={styles.terminalString}>'Coffee'</span>,{" "}
              <span className={styles.terminalString}>4.99</span>);
            </code>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} · Documentation`}
      description="Unified Apple Pay and Google Pay for React Native. One hook, native buttons, type-safe API. Expo compatible."
    >
      <HomepageHeader />
      <main className={styles.mainContent}>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
