'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const SEO_POPULATE = {
  seo: {
    populate: {
      shareImage: true,
      metaSocial: { populate: { image: true } },
    },
  },
};

module.exports = createCoreController('api::article.article', () => ({
  /** @param {import('koa').Context} ctx */
  async find(ctx) {
    ctx.query.populate = typeof ctx.query.populate === 'object' && ctx.query.populate !== null
      ? { ...SEO_POPULATE, ...ctx.query.populate }
      : SEO_POPULATE;
    return super.find(ctx);
  },
  /** @param {import('koa').Context} ctx */
  async findOne(ctx) {
    ctx.query.populate = typeof ctx.query.populate === 'object' && ctx.query.populate !== null
      ? { ...SEO_POPULATE, ...ctx.query.populate }
      : SEO_POPULATE;
    return super.findOne(ctx);
  },
}));
