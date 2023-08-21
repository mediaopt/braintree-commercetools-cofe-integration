import { ActionContext, Request, Response } from '@frontastic/extension-types/src/ts/index';
import { Guid } from '../../commerce-commercetools/utils/Guid';

import { Cart } from '@Types/cart/Cart';
import { Money } from '@Types/product/Money';

import { CartFetcher } from '../../commerce-commercetools/utils/CartFetcher';
import { Address } from '@Types/account/Address';

import { PaymentApi, LineItem, Shipping } from '../apis/PaymentApi';
import { CartApi } from '@Commerce-commercetools/apis/CartApi';
import { getLocale } from '../../commerce-commercetools/utils/Request';
import { PaymentStatuses } from '@Types/cart/Payment';

async function updateCartFromRequest(cartApi: CartApi, request: Request, actionContext: ActionContext): Promise<Cart> {
  let cart = await CartFetcher.fetchCart(cartApi, request, actionContext);

  if (request?.body === undefined || request?.body === '') {
    return cart;
  }

  const body: {
    account?: { email?: string };
    shipping?: Address;
    billing?: Address;
  } = JSON.parse(request.body);

  if (body?.account?.email === '') {
    return cart;
  }

  if (body?.account?.email !== undefined) {
    cart = await cartApi.setEmail(cart, body.account.email);
  }

  if (body?.shipping !== undefined || body?.billing !== undefined) {
    const shippingAddress = body?.shipping !== undefined ? body.shipping : body.billing;
    const billingAddress = body?.billing !== undefined ? body.billing : body.shipping;

    cart = await cartApi.setShippingAddress(cart, shippingAddress);
    cart = await cartApi.setBillingAddress(cart, billingAddress);
  }

  return cart;
}

export const createPayment = async (request: Request, actionContext: ActionContext) => {
  const paymentApi = new PaymentApi(actionContext.frontasticContext, getLocale(request));
  const accountId = request.sessionData.account?.accountId;

  let braintreeCustomerId;
  if (accountId) {
    const customer = await paymentApi.getCustomer(accountId);
    if (customer.braintreeCustomerId) {
      braintreeCustomerId = customer.braintreeCustomerId;
    }
  }

  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));

  let cart = await updateCartFromRequest(cartApi, request, actionContext);

  let centAmount = cart.sum.centAmount;

  let shippingMethod;
  if (cart.availableShippingMethods) {
    shippingMethod = cart.availableShippingMethods[cart.availableShippingMethods.length - 1];
    if (shippingMethod) {
      centAmount += shippingMethod.rates[0].price.centAmount;
    }
  }

  const requestAmountPlanned: Money = {
    currencyCode: cart.sum.currencyCode,
    centAmount: centAmount,
  };

  const isThereInitBraintreeSamePayment = cart.payments.some(
    (payment) =>
      payment.paymentProvider === 'Braintree' &&
      payment.paymentStatus === PaymentStatuses.INIT &&
      payment.amountPlanned.centAmount === requestAmountPlanned.centAmount,
  );

  if (!isThereInitBraintreeSamePayment) {
    cart = await cartApi.addPayment(cart, {
      id: Guid.newGuid(),
      paymentProvider: 'Braintree',
      amountPlanned: requestAmountPlanned,
      paymentStatus: PaymentStatuses.INIT,
      paymentMethod: '',
    });
  }

  const lastPaymentIndex = cart.payments.length - 1;
  const cartPaymentDebug = JSON.parse(cart.payments[lastPaymentIndex].debug);
  const amountPlanned = cart.payments[lastPaymentIndex].amountPlanned;

  const lineItems = cart.lineItems;

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify({
      id: cartPaymentDebug.id,
      version: cartPaymentDebug.version,
      amountPlanned,
      lineItems,
      shippingMethod,
      braintreeCustomerId,
    }),
    sessionData: request.sessionData,
  };
  return response;
};

export const createPaymentForVault = async (request: Request, actionContext: ActionContext) => {
  const paymentApi = new PaymentApi(actionContext.frontasticContext, getLocale(request));
  const accountId = request.sessionData.account?.accountId;

  let braintreeCustomerId;
  let customerVersion: number;
  if (accountId) {
    const customer = await paymentApi.getCustomer(accountId);
    if (customer.braintreeCustomerId) {
      braintreeCustomerId = customer.braintreeCustomerId;
    }
    customerVersion = customer.customerVersion;
  }

  const cartApi = new CartApi(actionContext.frontasticContext, getLocale(request));

  let cart = await updateCartFromRequest(cartApi, request, actionContext);

  const requestAmountPlanned: Money = {
    currencyCode: cart.sum.currencyCode,
    centAmount: 0,
  };

  cart = await cartApi.addPayment(cart, {
    id: Guid.newGuid(),
    paymentProvider: 'Braintree',
    amountPlanned: requestAmountPlanned,
    paymentStatus: PaymentStatuses.INIT,
    paymentMethod: '',
  });

  const lastPaymentIndex = cart.payments.length - 1;
  const cartPaymentDebug = JSON.parse(cart.payments[lastPaymentIndex].debug);
  const amountPlanned = cart.payments[lastPaymentIndex].amountPlanned;

  const lineItems: [] = [];

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify({
      id: cartPaymentDebug.id,
      version: cartPaymentDebug.version,
      braintreeCustomerId,
      customerVersion,
      lineItems,
      amountPlanned,
      requestAmountPlanned,
    }),
    sessionData: request.sessionData,
  };
  return response;
};

export const getClientToken = async (request: Request, actionContext: ActionContext) => {
  const accountId = request.sessionData.account?.accountId;

  const requestBody = JSON.parse(request.body) as { paymentId: string; paymentVersion: number };
  const paymentApi = new PaymentApi(actionContext.frontasticContext, getLocale(request));

  const result = await paymentApi.getClientToken(requestBody.paymentId, requestBody.paymentVersion, accountId);

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify({
      clientToken: result.clientToken,
      paymentVersion: result.paymentVersion,
    }),
    sessionData: request.sessionData,
  };
  return response;
};

export const vaultPaymentMethod = async (request: Request, actionContext: ActionContext) => {
  const requestBody = JSON.parse(request.body) as {
    customerId: string;
    customerVersion: number;
    paymentMethodNonce: string;
  };
  const paymentApi = new PaymentApi(actionContext.frontasticContext, getLocale(request));

  const result = await paymentApi.pureVault(
    requestBody.customerId,
    requestBody.customerVersion,
    requestBody.paymentMethodNonce,
  );
  const response: { statusCode: number } = {
    statusCode: result ? 200 : 500,
  };
  return response;
};

export const setLocalPaymentId = async (request: Request, actionContext: ActionContext) => {
  const requestBody = JSON.parse(request.body) as { paymentId: string; paymentVersion: number; localPaymentId: string };
  const paymentApi = new PaymentApi(actionContext.frontasticContext, getLocale(request));

  const result = await paymentApi.setLocalPaymentId(
    requestBody.paymentId,
    requestBody.paymentVersion,
    requestBody.localPaymentId,
  );

  const response: { statusCode: number; paymentVersion: number } = {
    statusCode: result ? 200 : 500,
    paymentVersion: result.paymentVersion,
  };
  return response;
};

export const getAchVaultToken = async (request: Request, actionContext: ActionContext) => {
  const accountId = request.sessionData.account?.accountId;

  const { paymentMethodNonce } = JSON.parse(request.body) as {
    paymentMethodNonce: string;
  };

  let body = {};
  if (!accountId) {
    body = { status: false, message: 'In order to use ACH you need to register' };
  } else {
    const paymentApi = new PaymentApi(actionContext.frontasticContext, getLocale(request));
    let { braintreeCustomerId, customerVersion } = await paymentApi.getCustomer(accountId);

    if (!braintreeCustomerId) {
      await paymentApi.createCustomer(accountId, customerVersion);
      const customer = await paymentApi.getCustomer(accountId);
      braintreeCustomerId = customer.braintreeCustomerId;
      customerVersion = customer.customerVersion;
    }

    const vaultResponse = await paymentApi.createAchVaultToken(paymentMethodNonce, accountId, customerVersion);
    const vaultResponseJson = JSON.parse(vaultResponse);

    if (vaultResponseJson.token) {
      body = { status: true, token: vaultResponseJson.token, verified: vaultResponseJson.verified };
    } else {
      body = { status: false, message: vaultResponseJson.message };
    }
  }

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify(body),
    sessionData: request.sessionData,
  };
  return response;
};

export const createPurchase = async (request: Request, actionContext: ActionContext) => {
  const accountId = request.sessionData.account?.accountId;

  const requestBody = JSON.parse(request.body) as {
    paymentVersion: number;
    paymentId: string;
    paymentMethodNonce: string;
    storeInVault?: boolean;
    merchantAccountId?: string;
    deviceData?: string;
    lineItems?: LineItem[];
    shipping?: Shipping;
    taxAmount?: string;
    shippingAmount?: string;
    discountAmount?: string;
  };
  const paymentApi = new PaymentApi(actionContext.frontasticContext, getLocale(request));
  const {
    paymentId,
    paymentVersion,
    paymentMethodNonce,
    storeInVault,
    merchantAccountId,
    deviceData,
    lineItems,
    shipping,
    taxAmount,
    shippingAmount,
    discountAmount,
  } = requestBody;

  const result = await paymentApi.purchase(
    paymentId,
    paymentVersion,
    paymentMethodNonce,
    accountId,
    storeInVault,
    merchantAccountId,
    deviceData,
    lineItems,
    shipping,
    taxAmount,
    shippingAmount,
    discountAmount,
  );

  const response: Response = {
    statusCode: 200,
    body: JSON.stringify({ result }),
    sessionData: request.sessionData,
  };
  return response;
};
