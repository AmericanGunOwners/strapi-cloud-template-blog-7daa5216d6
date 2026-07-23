module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT'),
    },
  },
  flags: {
    nps: env.bool('FLAG_NPS', true),
    promoteEE: env.bool('FLAG_PROMOTE_EE', true),
  },
  preview: {
    enabled: true,
    config: {
      allowedOrigins: [env('CLIENT_URL', 'http://localhost:5173')],
      async handler(uid, { documentId, locale, status }) {
        if (uid !== 'api::article.article') {
          return undefined;
        }

        const document = await strapi.documents(uid).findOne({ documentId });
        if (!document?.slug) {
          return undefined;
        }

        const params = new URLSearchParams({
          secret: "8mkIKN8yZUbHvb5YVtl7AukFBpMiGLznicOog6Vvsak=",
          status,
        });
        if (locale) {
          params.set('locale', locale);
        }

        return `${env('CLIENT_URL', 'https://www.americangunowners.com')}/preview/articles/${document.slug}?${params.toString()}`;
      },
    },
  },
});
