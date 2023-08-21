'use client';
import { useState, useEffect, useMemo } from 'react';
import cookieCutter from 'cookie-cutter';
import { useRouter } from 'next/router';

import { PayPal } from 'braintree-commercetools-client/dist/esm';

import { useCart } from '../../../frontastic';

interface Props {
  handleAddToCart?: () => void;
  showPayPalDirectly?: boolean;
}

const CartCheckout = ({ handleAddToCart, showPayPalDirectly = false }: Props) => {
  const [frontasticSession, setFrontasticSession] = useState();
  const [shippingOptions, setShippingOptions] = useState([]);
  const [showPayPal, setShowPayPal] = useState(showPayPalDirectly);
  const { getShippingMethods } = useCart();

  useEffect(() => {
    const shippingOptions = [];
    getShippingMethods().then((data) => {
      data.forEach((method) => {
        method.rates.forEach((rate) => {
          rate.locations.forEach((location) => {
            shippingOptions.push({ countryCode: location.country, amount: rate.price.centAmount / 100 });
          });
        });
      });
      setShippingOptions(shippingOptions);
    });
  }, []);

  useEffect(() => {
    setShowPayPal(showPayPalDirectly);
  }, [showPayPalDirectly]);

  const { checkout, removeItem, updateCart } = useCart();
  const cartData = useCart().data;
  const router = useRouter();

  const apiHubUrl = process.env.NEXT_PUBLIC_FRONTASTIC_HOST;
  const cartInformation = {
    account: {
      email: '',
    },
    billing: {
      firstName: '',
      lastName: '',
      streetName: '',
      streetNumber: '',
      city: '',
      country: '',
      postalCode: '',
    },
    shipping: {
      firstName: '',
      lastName: '',
      streetName: '',
      streetNumber: '',
      city: '',
      country: '',
      postalCode: '',
    },
  };
  const submitText = 'pay';

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

  const checkoutInformation = useMemo(() => {
    return {
      createPaymentUrl: `${apiHubUrl}/action/payment/createPayment`,
      getClientTokenUrl: `${apiHubUrl}/action/payment/getClientToken`,
      purchaseUrl: `${apiHubUrl}/action/payment/createPurchase`,
      sessionKey: 'frontastic-session',
      sessionValue: frontasticSession,
      purchaseCallback: async (result, options) => {
        await checkout(options);
        router.push('/thank-you');
      },
      cartInformation: cartInformation,
      buttonText: submitText,
      fullWidth: true,
      lineItems: lineItems,
    };
  }, [apiHubUrl, frontasticSession, cartInformation, submitText, lineItems]);

  useEffect(() => {
    setFrontasticSession(cookieCutter.get('frontastic-session'));
  }, []);
  if (!frontasticSession || !apiHubUrl) return <></>;

  const manageCart = async () => {
    await Promise.all(cartData.lineItems.map(async (lineItem) => await removeItem(lineItem.lineItemId)));
    if (handleAddToCart) {
      await handleAddToCart();
    }
    setShowPayPal(true);
  };

  return (
    <main>
      {showPayPal && shippingOptions ? (
        <PayPal
          flow="checkout"
          buttonColor={'gold'}
          buttonLabel={'buynow'}
          payLater={false}
          commit={true}
          locale="en_GB"
          intent={'capture'}
          enableShippingAddress={true}
          shippingAddressEditable={false}
          shippingOptions={shippingOptions}
          {...checkoutInformation}
        />
      ) : (
        <button
          type="button"
          onClick={manageCart}
          className="flex w-full flex-1 items-center justify-center rounded-md border border-transparent bg-accent-400 fill-white py-3  px-8 text-base font-medium text-white transition duration-150 ease-out hover:bg-accent-500 focus:bg-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-400 focus:ring-offset-2 focus:ring-offset-gray-50 disabled:bg-gray-400"
        >
          Buy Now
        </button>
      )}
    </main>
  );
};

export default CartCheckout;
