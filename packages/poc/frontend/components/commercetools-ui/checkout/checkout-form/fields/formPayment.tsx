import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  CreditCard,
  PayPal,
  GooglePay,
  Venmo,
  ApplePay,
  ACH,
  Bancontact,
  P24,
  Sofort,
  BLIK,
  MyBank,
  EPS,
  Giropay,
  Grabpay,
  IDeal,
} from 'braintree-commercetools-client/dist/esm';
import { useAccount } from 'frontastic';

import { useFormat } from '../../../../../helpers/hooks/useFormat';
import { useCart } from '../../../../../frontastic';

import FormRadioGroup from './formRadioGroup';
import FormInput from './formInput';
import FormButton from './formButton';

import cookieCutter from 'cookie-cutter';

type PaymentMethodsType = {
  id: string;
  label: string;
  value: string;
  isDefault: boolean;
  component: ReactNode;
}[];

export const PaymentMethods = ({ updateFormInput, cartInformation, submitText, invoiceData }) => {
  const { checkout } = useCart();
  const router = useRouter();
  const { formatMessage: formatCheckoutMessage } = useFormat({ name: 'checkout' });
  const frontasticSession = cookieCutter.get('frontastic-session');
  const apiHubUrl = process.env.NEXT_PUBLIC_FRONTASTIC_HOST;

  const getAccount = useAccount();
  const account = getAccount.account;

  const localPaymentParams = {
    fallbackUrl: '/test',
    fallbackButtonText: 'purchase',
    saveLocalPaymentIdUrl: `${apiHubUrl}/action/payment/setLocalPaymentId`,
    merchantAccountId: '',
  };

  const cartData = useCart().data;
  const lineItems = [];
  cartData?.lineItems?.forEach((item) => {
    let totalPrice = item.totalPrice.centAmount.toString();
    totalPrice = totalPrice.length > 2 ? totalPrice : '000' + totalPrice;

    let unitPrice = item.price.centAmount.toString();
    unitPrice = unitPrice.length > 2 ? unitPrice : '000' + unitPrice;

    lineItems.push({
      name: item.name,
      kind: 'debit',
      unitOfMeasure: 'unit',
      taxAmount: '0.00',
      discountAmount: '0.00',
      quantity: item.count.toString(),
      unitAmount:
        unitPrice.substring(0, unitPrice.length - 2) +
        '.' +
        unitPrice.substring(unitPrice.length - 2, unitPrice.length),
      totalAmount:
        totalPrice.substring(0, totalPrice.length - 2) +
        '.' +
        totalPrice.substring(totalPrice.length - 2, totalPrice.length),
      productCode: item.productId.substring(0, 12),
      commodityCode: '',
    });
  });

  const shipping = cartInformation
    ? {
        countryCodeAlpha2: cartInformation.shipping.country,
        firstName: cartInformation.shipping.firstName,
        lastName: cartInformation.shipping.lastName,
        postalCode: cartInformation.shipping.postalCode,
        streetAddress: cartInformation.shipping.streetName + ' ' + cartInformation.shipping.streetNumber,
        region: cartInformation.shipping.city,
      }
    : undefined;

  const checkoutInformation = useMemo(() => {
    return {
      createPaymentUrl: `${apiHubUrl}/action/payment/createPayment`,
      getClientTokenUrl: `${apiHubUrl}/action/payment/getClientToken`,
      purchaseUrl: `${apiHubUrl}/action/payment/createPurchase`,
      sessionKey: 'frontastic-session',
      sessionValue: frontasticSession,
      purchaseCallback: async (result) => {
        await checkout();
        router.push('/thank-you');
      },
      cartInformation: cartInformation,
      buttonText: submitText,
      fullWidth: true,
      shipping: shipping,
      lineItems: lineItems,
      taxAmount: '0.00',
      discountAmount: '0.00',
      shippingAmount: '0.00',
    };
  }, [apiHubUrl, frontasticSession, cartInformation, submitText, lineItems]);

  const billingCountryCode = cartInformation.billing.country.toLowerCase();

  const paymentMethods = useMemo(() => {
    const initialMethods: PaymentMethodsType = [
      {
        id: 'cc',
        label: formatCheckoutMessage({ id: 'credit card', defaultMessage: 'Credit card' }),
        value: 'cc',
        isDefault: false,
        component: (
          <div>
            <CreditCard {...checkoutInformation} enableVaulting={true} />
          </div>
        ),
      },
      {
        id: 'paypalbutton',
        label: formatCheckoutMessage({ id: 'paypalbutton', defaultMessage: 'PayPal' }),
        value: 'paypalbutton',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <PayPal
              flow="checkout"
              {...checkoutInformation}
              buttonColor={'gold'}
              buttonLabel={'pay'}
              payLater={true}
              payLaterButtonColor={'blue'}
            />
          </div>
        ),
      },

      {
        id: 'googlepay',
        label: formatCheckoutMessage({ id: 'googlepay', defaultMessage: 'Google Pay' }),
        value: 'googlepay',
        isDefault: false,
        component: (
          <div>
            <GooglePay
              environment={'TEST'}
              totalPriceStatus={'FINAL'}
              googleMerchantId={'merchant-id-from-google'}
              acquirerCountryCode={'DE'}
              {...checkoutInformation}
            />
          </div>
        ),
      },
      {
        id: 'venmo',
        label: formatCheckoutMessage({ id: 'venmo', defaultMessage: 'Venmo' }),
        value: 'venmo',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <Venmo
              mobileWebFallBack={true}
              desktopFlow={'desktopWebLogin'}
              paymentMethodUsage={'multi_use'}
              useTestNonce={true}
              setVenmoUserName={(venmoName) => console.log(venmoName)}
              ignoreBowserSupport={true}
              {...checkoutInformation}
            />
          </div>
        ),
      },
      {
        id: 'ach',
        label: formatCheckoutMessage({ id: 'ach', defaultMessage: 'ACH' }),
        value: 'ach',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <ACH
              mandateText='By clicking ["Checkout"], I authorize Braintree, a service of PayPal, on behalf of [your business name here] (i) to verify my bank account information using bank information and consumer reports and (ii) to debit my bank account.'
              getAchVaultTokenURL={`${apiHubUrl}/action/payment/getAchVaultToken`}
              {...checkoutInformation}
            />
          </div>
        ),
      },
      {
        id: 'paypalvaultbutton',
        label: formatCheckoutMessage({ id: 'paypalvaultbutton', defaultMessage: 'PayPal Vault' }),
        value: 'paypalvaultbutton',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <PayPal
              flow="vault"
              {...checkoutInformation}
              buttonColor={'gold'}
              buttonLabel={'pay'}
              payLater={true}
              payLaterButtonColor={'blue'}
              locale="en_GB"
              intent={'capture'}
              commit={true}
              enableShippingAddress={true}
              shippingAddressEditable={false}
              billingAgreementDescription="Your agreement description"
            />
          </div>
        ),
      },
    ];

    if (billingCountryCode === 'be') {
      initialMethods.push({
        id: 'bancontact',
        label: formatCheckoutMessage({ id: 'bancontact', defaultMessage: 'Bancontact' }),
        value: 'bancontact',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <Bancontact
              currencyCode="EUR"
              countryCode="BE"
              paymentType="bancontact"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });
    } else if (billingCountryCode === 'pl') {
      initialMethods.push({
        id: 'p24',
        label: formatCheckoutMessage({ id: 'p24', defaultMessage: 'P24' }),
        value: 'p24',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <P24
              currencyCode="EUR"
              paymentType="p24"
              countryCode="PL"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });

      initialMethods.push({
        id: 'blik',
        label: formatCheckoutMessage({ id: 'blik', defaultMessage: 'BLIK' }),
        value: 'blik',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <BLIK
              currencyCode="PLN"
              countryCode="PL"
              paymentType="blik"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });
    } else if (billingCountryCode === 'de') {
      initialMethods.push({
        id: 'sofort',
        label: formatCheckoutMessage({ id: 'sofort', defaultMessage: 'Sofort' }),
        value: 'sofort',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <Sofort
              currencyCode="EUR"
              paymentType="sofort"
              countryCode="DE"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });

      initialMethods.push({
        id: 'giropay',
        label: formatCheckoutMessage({ id: 'giropay', defaultMessage: 'Giropay' }),
        value: 'giropay',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <Giropay
              currencyCode="EUR"
              countryCode="DE"
              paymentType="giropay"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });
    } else if (billingCountryCode === 'it') {
      initialMethods.push({
        id: 'mybank',
        label: formatCheckoutMessage({ id: 'mybank', defaultMessage: 'MyBank' }),
        value: 'mybank',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <MyBank
              currencyCode="EUR"
              countryCode="IT"
              paymentType="mybank"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });
    } else if (billingCountryCode === 'at') {
      initialMethods.push({
        id: 'eps',
        label: formatCheckoutMessage({ id: 'eps', defaultMessage: 'EPS' }),
        value: 'eps',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <EPS
              currencyCode="EUR"
              countryCode="AT"
              paymentType="eps"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });
    } else if (billingCountryCode === 'sg') {
      initialMethods.push({
        id: 'grabpay',
        label: formatCheckoutMessage({ id: 'grabpay', defaultMessage: 'Grabpay' }),
        value: 'grabpay',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <Grabpay
              currencyCode="SGD"
              countryCode="SG"
              paymentType="grabpay"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });
    } else if (billingCountryCode === 'nl') {
      initialMethods.push({
        id: 'ideal',
        label: formatCheckoutMessage({ id: 'grabpay', defaultMessage: 'IDeal' }),
        value: 'ideal',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <IDeal
              currencyCode="EUR"
              countryCode="NL"
              paymentType="ideal"
              {...localPaymentParams}
              {...checkoutInformation}
            />
          </div>
        ),
      });
    }

    if ('ApplePaySession' in window) {
      initialMethods.push({
        id: 'applepay',
        label: formatCheckoutMessage({ id: 'applepay', defaultMessage: 'Apple Pay' }),
        value: 'applepay',
        isDefault: false,
        component: (
          <div className="col-span-full">
            <ApplePay applePayDisplayName="My Store" {...checkoutInformation} />
          </div>
        ),
      });
    }

    initialMethods.push({
      id: 'invoice',
      label: formatCheckoutMessage({ id: 'invoice', defaultMessage: 'Invoice' }),
      value: 'invoice',
      isDefault: false,
      component: (
        <div className="col-span-full">
          <FormInput
            name="invoiceId"
            label={`${formatCheckoutMessage({ id: 'invoice', defaultMessage: 'Invoice' })} ID`}
            value={invoiceData.ivoiceValue}
            onChange={updateFormInput}
          />
          <FormButton
            buttonText={invoiceData.text}
            onClick={invoiceData.clickAction}
            isDisabled={invoiceData.invoiceValue.length === 0}
          />
        </div>
      ),
    });
    return initialMethods;
  }, [checkoutInformation]);

  const isUS = billingCountryCode === 'us';
  let countryOptions = useMemo(() => {
    return isUS
      ? paymentMethods
      : paymentMethods.filter((paymentMethod) => paymentMethod.id !== 'venmo' && paymentMethod.id !== 'ach');
  }, [paymentMethods, isUS]);

  countryOptions = useMemo(() => {
    return account ? countryOptions : countryOptions.filter((countryOption) => countryOption.id !== 'ach');
  }, [account, isUS]);

  const [activePaymentMethod, setActivePaymentMethod] = useState(undefined);

  useEffect(() => {
    updateFormInput('pay', activePaymentMethod);
  }, [activePaymentMethod]);

  return (
    <>
      <FormRadioGroup
        headline={formatCheckoutMessage({ id: 'payment', defaultMessage: 'Payment' })}
        subline={formatCheckoutMessage({
          id: 'askPaymentPreference',
          defaultMessage: 'What do you prefer to pay with?',
        })}
        options={countryOptions}
        className="z-10 col-span-full pt-6"
        onChange={setActivePaymentMethod}
        activePaymentMethod={activePaymentMethod}
      />
    </>
  );
};
