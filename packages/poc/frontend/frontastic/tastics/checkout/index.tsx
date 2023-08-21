import React from 'react';
import Checkout from '../../../components/commercetools-ui/checkout';
import { getCountryOptions } from '../../../helpers/countryOptions';

const exampleCountries = ['us', 'de', 'it', 'nl', 'at', 'gb', 'pl', 'sg', 'be'];

const CheckoutTastic = ({ data }) => {
  return <Checkout shippingCountryOptions={getCountryOptions(exampleCountries)} />;
};

export default CheckoutTastic;
