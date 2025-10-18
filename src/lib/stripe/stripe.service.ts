import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENVEnum } from '@project/common/enum/env.enum';
import Stripe from 'stripe';
import { StripePaymentMetadata } from './stripe.types';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.getOrThrow<string>(
      ENVEnum.STRIPE_SECRET_KEY,
    );
    this.stripe = new Stripe(secretKey);
  }

  // Product & Price Management
  async createProductWithPrice({
    title,
    description,
    price,
    currency = 'usd',
    interval = 'month',
  }: {
    title: string;
    description?: string;
    price: number;
    currency?: string;
    interval?: 'month' | 'year';
  }) {
    const product = await this.stripe.products.create({
      name: title,
      description,
    });

    const stripePrice = await this.stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price * 100), // convert to cents
      currency,
      recurring: { interval },
    });

    this.logger.log(
      `Created Stripe product ${product.id} with price ${stripePrice.id}`,
    );

    return { product, stripePrice };
  }

  async updatePrice({
    productId,
    newPrice,
    currency = 'usd',
    interval = 'month',
  }: {
    productId: string;
    newPrice: number;
    currency?: string;
    interval?: 'month' | 'year';
  }) {
    const stripePrice = await this.stripe.prices.create({
      product: productId,
      unit_amount: Math.round(newPrice * 100),
      currency,
      recurring: { interval },
    });

    this.logger.log(
      `Created new price ${stripePrice.id} for product ${productId}`,
    );

    return stripePrice;
  }

  async deleteProduct(productId: string) {
    // Step 1: Mark the product inactive
    const deletedProduct = await this.stripe.products.update(productId, {
      active: false,
    });
    this.logger.log(`Product ${productId} marked inactive`);

    // Step 2: Fetch all related prices
    const prices = await this.stripe.prices.list({
      product: productId,
      active: true,
    });

    // Step 3: Deactivate all associated prices
    for (const price of prices.data) {
      await this.stripe.prices.update(price.id, { active: false });
      this.logger.log(`Price ${price.id} marked inactive`);
    }

    return deletedProduct;
  }

  // Payment Intent Management
  async retrievePaymentIntent(paymentIntentId: string) {
    const pi = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    this.logger.log(`Retrieved PaymentIntent ${paymentIntentId}`);
    return pi;
  }

  // Payment Intent (for one-time payments)
  async createPaymentIntent({
    amount,
    currency,
    customerId,
    metadata,
  }: {
    amount: number;
    currency: string;
    customerId: string;
    metadata: StripePaymentMetadata;
  }) {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount,
        currency,
        customer: customerId,
        receipt_email: metadata.email,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata,
      },
      {
        idempotencyKey: `pi_${metadata.userId}_${metadata.planId}`,
      },
    );

    this.logger.log(`Created payment intent ${intent.id}`);
    return intent;
  }

  // Customer Management
  async createCustomer({
    email,
    name,
    metadata,
  }: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }) {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata,
    });
    this.logger.log(`Created Stripe customer ${customer.id}`);
    return customer;
  }

  // Webhook Utility
  constructWebhookEvent(rawBody: Buffer, signature: string) {
    const endpointSecret = this.configService.getOrThrow<string>(
      ENVEnum.STRIPE_WEBHOOK_SECRET,
    );
    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        endpointSecret,
      );
    } catch (err) {
      this.logger.error('Invalid webhook signature', err);
      throw new Error('Invalid webhook signature');
    }
  }
}
