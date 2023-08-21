import { useMemo } from 'react';
import { CartInformation } from 'braintree-commercetools-client/dist/esm/src/types';

export const useCheckoutData = (
  data,
  billingSameAsShipping,
  billingInformation,
  shippingInformation,
  submitText,
  submitForm,
) => {
  const cartInformation: CartInformation = useMemo(() => {
    return {
      account: { email: data.emailAddress },
      billing: billingInformation,
      shipping: billingSameAsShipping ? billingInformation : shippingInformation,
    };
  }, [data.emailAdddress, billingInformation, shippingInformation]);

  const invoiceValue = useMemo(() => {
    return data.invoiceId ?? '';
  }, [data.invoiceId]);

  const invoiceData = useMemo(() => {
    return {
      invoiceValue: invoiceValue,
      text: submitText,
      clickAction: submitForm,
    };
  }, [submitText, submitForm, invoiceValue]);
  return { cartInformation, invoiceData };
};
