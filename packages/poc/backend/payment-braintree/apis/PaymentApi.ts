import axios from 'axios';

import { BaseApi } from '../../commerce-commercetools/apis/BaseApi';
import { Guid } from '../../commerce-commercetools/utils/Guid';

type TransactionSaleResponse = {
  success: boolean;
  message: string;
  processorResponseText?: string;
  amount?: number;
  currencyIsoCode?: string;
  paymentInstrumentType?: string;
  networkTransactionId?: string;
  processorResponseCode?: string;
};

export type LineItem = {
  name?: string;
  kind: string;
  quantity: string;
  unitAmount: string;
  unitOfMeasure?: string;
  totalAmount: string;
  taxAmount?: string;
  discountAmount?: string;
  productCode?: string;
  commodityCode?: string;
};

export type Shipping = {
  company?: string;
  countryCodeAlpha2?: string;
  countryCodeAlpha3?: string;
  countryCodeNumeric?: string;
  countryName?: string;
  extendedAddress?: string;
  firstName?: string;
  lastName?: string;
  locality?: string;
  postalCode?: string;
  region?: string;
  streetAddress?: string;
};

export class PaymentApi extends BaseApi {
  protected instance = axios.create({
    baseURL: `${this.clientSettings.hostUrl}/${this.clientSettings.projectKey}`,
    headers: {
      Authorization: `Bearer ${this.token.token}`,
      'content-type': 'application/json',
    },
  });

  getCustomer: (accountId: string) => Promise<{
    braintreeCustomerId: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    customerVersion: number;
  }> = async (accountId: string) => {
    const account = await this.requestBuilder()
      .customers()
      .withId({ ID: accountId })
      .get()
      .execute()
      .then((response) => {
        return response.body;
      })
      .catch((error) => {
        throw error;
      });

    const { custom, firstName, lastName, email, companyName, version } = account;
    const braintreeCustomerId = custom?.fields['braintreeCustomerId'];

    return {
      braintreeCustomerId,
      firstName,
      lastName,
      email,
      company: companyName,
      customerVersion: version,
    };
  };

  getClientToken: (
    paymentId: string,
    paymentVersion: number,
    accountId?: string,
    merchantId?: string,
  ) => Promise<{ clientToken: string; paymentVersion: number }> = async (
    paymentId: string,
    paymentVersion: number,
    accountId?: string,
    merchantId?: string,
  ) => {
    let braintreeCustomerId;
    let fieldValue: { [index: string]: any } = {};
    if (accountId) {
      braintreeCustomerId = (await this.getCustomer(accountId)).braintreeCustomerId;
    }
    if (merchantId) {
      fieldValue.merchantId = merchantId;
    }
    if (braintreeCustomerId) {
      fieldValue.customerId = braintreeCustomerId;
    }

    const payload = {
      version: paymentVersion,
      actions: [
        {
          action: 'setCustomType',
          type: {
            key: 'braintree-payment-type',
            typeId: 'type',
          },
          fields: {
            getClientTokenRequest: JSON.stringify(fieldValue),
            BraintreeOrderId: Guid.newGuid(),
          },
        },
      ],
    };

    try {
      const response = await this.instance.post<{
        custom: { fields: { getClientTokenResponse: string } };
        version: number;
      }>(`/payments/${paymentId}`, payload);

      return {
        clientToken: response.data.custom.fields.getClientTokenResponse,
        paymentVersion: response.data.version,
      };
    } catch (error) {
      throw error;
    }
  };

  purchase: (
    paymentId: string,
    paymentVersion: number,
    paymentMethodNonce: string,
    accountId?: string,
    storeInVault?: boolean,
    merchantAccountId?: string,
    deviceData?: string,
    lineItems?: LineItem[],
    shipping?: Shipping,
    taxAmount?: string,
    shippingAmount?: string,
    discountAmount?: string,
  ) => Promise<{ paymentVersion: number; transactionSaleResponse: TransactionSaleResponse }> = async (
    paymentId: string,
    paymentVersion: number,
    paymentMethodNonce: string,
    accountId?: string,
    storeInVault?: boolean,
    merchantAccountId?: string,
    deviceData?: string,
    lineItems?: LineItem[],
    shipping?: Shipping,
    taxAmount?: string,
    shippingAmount?: string,
    discountAmount?: string,
  ) => {
    const transactionSaleRequest = async (
      paymentId: string,
      paymentVersion: number,
    ): Promise<TransactionSaleResponse & { paymentVersion: number }> => {
      let valuePayload: {} = { paymentMethodNonce };
      if (accountId) {
        const { braintreeCustomerId, firstName, lastName, email, company } = await this.getCustomer(accountId);
        if (braintreeCustomerId) {
          valuePayload = { ...valuePayload, customerId: braintreeCustomerId };
        } else {
          valuePayload = { ...valuePayload, customer: { id: accountId, firstName, lastName, email, company } };
        }
      }

      if (storeInVault) {
        valuePayload = { ...valuePayload, options: { store_in_vault_on_success: true } };
      }

      if (merchantAccountId) {
        valuePayload = { ...valuePayload, merchantAccountId: merchantAccountId };
      }

      if (deviceData) {
        valuePayload = { ...valuePayload, deviceData: deviceData };
      }

      if (lineItems) {
        valuePayload = { ...valuePayload, lineItems: lineItems };
      }

      if (shipping) {
        valuePayload = { ...valuePayload, shipping: shipping };
      }

      if (taxAmount) {
        valuePayload = { ...valuePayload, taxAmount: taxAmount };
      }

      if (shippingAmount) {
        valuePayload = { ...valuePayload, shippingAmount: shippingAmount };
      }

      if (discountAmount) {
        valuePayload = { ...valuePayload, discountAmount: discountAmount };
      }

      const payload = {
        version: paymentVersion,
        actions: [
          {
            action: 'setCustomField',
            name: 'transactionSaleRequest',
            value: JSON.stringify(valuePayload),
          },
        ],
      };

      const response = await this.instance.post<{
        custom: { fields: { transactionSaleResponse: string } };
        version: number;
      }>(`/payments/${paymentId}`, payload);

      let transactionSaleResponse = JSON.parse(
        response.data.custom.fields.transactionSaleResponse,
      ) as TransactionSaleResponse;

      const processorResponseCode = parseInt(transactionSaleResponse.processorResponseCode);
      if (processorResponseCode >= 1000 && processorResponseCode <= 1999) {
        transactionSaleResponse = {
          success: true,
          message: 'Thank you for your purchase!',
          ...transactionSaleResponse,
        };
      }
      return { ...transactionSaleResponse, paymentVersion: response.data.version };
    };

    try {
      let transactionSaleResponse = await transactionSaleRequest(paymentId, paymentVersion);

      let returnPaymentVersion = transactionSaleResponse.paymentVersion;
      if (!transactionSaleResponse) {
        const payloadFindTransaction = {
          version: returnPaymentVersion,
          actions: [
            {
              action: 'setCustomField',
              name: 'findTransactionRequest',
              value: JSON.stringify({}),
            },
          ],
        };

        const responseFindTransaction = await this.instance.post<{
          custom: { fields: { findTransactionResponse: string } };
          version: number;
        }>(`/payments/${paymentId}`, payloadFindTransaction);

        const findTransactionResponse = JSON.parse(responseFindTransaction.data.custom.fields.findTransactionResponse);
        returnPaymentVersion = responseFindTransaction.data.version;

        if (findTransactionResponse.status !== true) {
          transactionSaleResponse = await transactionSaleRequest(paymentId, paymentVersion);
        }
      }

      return {
        transactionSaleResponse: transactionSaleResponse,
        paymentVersion: returnPaymentVersion,
      };
    } catch (error) {
      throw error;
    }
  };

  pureVault: (customerId: string, customerVersion: number, paymentMethodNonce: string) => Promise<{ status: number }> =
    async (customerId: string, customerVersion: number, paymentMethodNonce: string) => {
      const vaultRequest = async (customerId: string, customerVersion: number): Promise<{ status: number }> => {
        const payload = {
          version: customerVersion,
          actions: [
            {
              action: 'setCustomField',
              name: 'vaultRequest',
              value: paymentMethodNonce,
            },
          ],
        };

        const response = (await this.instance.post(`/customers/${customerId}`, payload)) as {
          data: { status: number };
        };
        return response.data;
      };

      try {
        let vaultResponse = await vaultRequest(customerId, customerVersion);

        return {
          status: vaultResponse.status,
        };
      } catch (error) {
        throw error;
      }
    };

  createCustomer: (accountId: string, version: number) => Promise<boolean> = async (
    accountId: string,
    version: number,
  ) => {
    const payload = {
      version: version,
      actions: [
        {
          action: 'setCustomType',
          type: {
            key: 'braintree-customer-type',
            typeId: 'type',
          },
          fields: {
            createRequest: '{}',
          },
        },
      ],
    };

    try {
      await this.instance.post(`/customers/${accountId}`, payload);

      return true;
    } catch (error) {
      throw error;
    }
  };

  setLocalPaymentId: (
    paymentId: string,
    version: number,
    localPaymentId: string,
  ) => Promise<{ paymentVersion: number }> = async (paymentId: string, version: number, localPaymentId: string) => {
    const payload = {
      version: version,
      actions: [
        {
          action: 'setCustomField',
          name: 'LocalPaymentMethodsPaymentId',
          value: localPaymentId,
        },
      ],
    };

    try {
      const response = await this.instance.post(`/payments/${paymentId}`, payload);

      return {
        paymentVersion: response.data.version,
      };
    } catch (error) {
      throw error;
    }
  };

  createAchVaultToken: (paymentMethodNonce: string, accountId: string, version: number) => Promise<string> = async (
    paymentMethodNonce: string,
    accountId: string,
    version: number,
  ) => {
    const payload = {
      version: version,
      actions: [
        {
          action: 'setCustomField',
          name: 'vaultRequest',
          value: paymentMethodNonce,
        },
      ],
    };

    try {
      const response = await this.instance.post<{
        custom: { fields: { vaultResponse: string } };
        version: number;
      }>(`/customers/${accountId}`, payload);

      return response.data.custom.fields.vaultResponse;
    } catch (error) {
      throw error;
    }
  };
}
