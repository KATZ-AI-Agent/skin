// src/services/shopify/ShopifyService.js
import { Client } from '@shopify/shopify-api';
import { solanaPayService } from '../solanaPay/SolanaPayService.js';
import { ErrorHandler } from '../../core/errors/index.js';

class ShopifyService {
  constructor() {
    this.client = new Client({
      storefrontAccessToken: process.env.SHOPIFY_STOREFRONT_TOKEN,
      domain: process.env.SHOPIFY_DOMAIN
    });
  }

  async searchProducts(query) {
    try {
      const products = await this.client.product.fetchQuery({
        query: `title:*${query}*`
      });
      return products.map(this.formatProduct);
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  async createOrder(productId, paymentDetails) {
    try {
      const checkout = await this.client.checkout.create();
      await this.client.checkout.addLineItems(checkout.id, [{
        variantId: productId,
        quantity: 1
      }]);

      const payment = await solanaPayService.createPayment(
        paymentDetails.amount,
        checkout.id
      );

      return { checkout, payment };
    } catch (error) {
      await ErrorHandler.handle(error);
      throw error;
    }
  }

  formatProduct(product) {
    return {
      id: product.id,
      title: product.title,
      price: product.variants[0].price,
      image: product.images[0]?.src
    };
  }
}

export const shopifyService = new ShopifyService();
