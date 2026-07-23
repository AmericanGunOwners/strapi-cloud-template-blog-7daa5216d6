module.exports = {
  '*/1 * * * *': async ({ strapi }) => {
    const now = new Date().toISOString();

    const dueArticles = await strapi.documents('api::article.article').findMany({
      status: 'draft',
      filters: {
        publishAt: { $lte: now },
      },
    });

    for (const article of dueArticles) {
      await strapi.documents('api::article.article').publish({ documentId: article.documentId });
      await strapi.documents('api::article.article').update({
        documentId: article.documentId,
        data: { publishAt: null },
      });
    }
  },
};
