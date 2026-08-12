import { useFetchClient, useNotification } from '@strapi/admin/strapi-admin';
import { Feather } from '@strapi/icons';
import { MetadataPanel } from './extensions/metadata-panel/MetadataPanel';

const getPreviewUrl = async ({ get, model, documentId, activeTab }) => {
  const { data } = await get(`/content-manager/preview/url/${model}`, {
    params: {
      documentId,
      status: activeTab === 'published' ? 'published' : 'draft',
    },
  });

  return data?.data?.url;
};

const OpenPreviewInNewTabAction = ({ model, documentId, activeTab }) => {
  const { get } = useFetchClient();

  if (!documentId) {
    return null;
  }

  return {
    label: 'Open preview (new tab)',
    icon: null,
    position: 'header',
    onClick: async () => {
      try {
        const url = await getPreviewUrl({ get, model, documentId, activeTab });
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        console.error('Failed to open preview in a new tab', error);
      }
    },
  };
};

const CopyPreviewLinkAction = ({ model, documentId, activeTab }) => {
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();

  if (!documentId) {
    return null;
  }

  return {
    label: 'Copy preview link',
    icon: null,
    position: 'header',
    onClick: async () => {
      try {
        const url = await getPreviewUrl({ get, model, documentId, activeTab });
        if (url) {
          await navigator.clipboard.writeText(url);
          toggleNotification({ type: 'success', message: 'Preview link copied' });
        }
      } catch (error) {
        console.error('Failed to copy preview link', error);
        toggleNotification({ type: 'danger', message: 'Could not copy preview link' });
      }
    },
  };
};

const config = {
  locales: [],
};

const bootstrap = app => {
  app.getPlugin('content-manager').apis.addDocumentAction(actions => [
    ...actions,
    OpenPreviewInNewTabAction,
    CopyPreviewLinkAction,
  ]);

  app.getPlugin('content-manager').apis.addEditViewSidePanel(panels => [...panels, MetadataPanel]);
};

const register = app => {
  app.customFields.register({
    name: 'markdown-editor',
    type: 'text',
    icon: Feather,
    intlLabel: {
      id: 'markdown-editor.label',
      defaultMessage: 'Markdown editor (rich paste)',
    },
    intlDescription: {
      id: 'markdown-editor.description',
      defaultMessage:
        'Rich text editor that converts pasted content (links, headings, tables) into clean Markdown.',
    },
    components: {
      Input: async () =>
        import('./extensions/markdown-editor/Input').then(mod => ({
          default: mod.default,
        })),
    },
  });
};

export default {
  config,
  bootstrap,
  register,
};
