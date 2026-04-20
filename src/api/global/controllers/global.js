'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const SEO_POPULATE = {
  defaultSeo: {
    populate: {
      shareImage: true,
      metaSocial: { populate: { image: true } },
    },
  },
  favicon: true,
};

module.exports = createCoreController('api::global.global', () => ({
  /** @param {import('koa').Context} ctx */
  async find(ctx) {
    ctx.query.populate = typeof ctx.query.populate === 'object' && ctx.query.populate !== null
      ? { ...SEO_POPULATE, ...ctx.query.populate }
      : SEO_POPULATE;
    return super.find(ctx);
  },
}));
