import * as React from 'react';
import { Flex, Typography } from '@strapi/design-system';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value) {
  return value ? DATE_FORMATTER.format(new Date(value)) : null;
}

function MetadataField({ label, value }) {
  return (
    <Flex direction="column" alignItems="flex-start" gap={1} width="100%">
      <Typography variant="pi" fontWeight="bold" textColor="neutral600">
        {label}
      </Typography>
      <Typography variant="omega">{value}</Typography>
    </Flex>
  );
}

// `firstPublishedAt` is Strapi's own "stays static once set" timestamp (enabled via
// features.future.experimental_firstPublishedAt in config/features.js) - unlike
// `publishedAt`, it is set once on first publish and never changes on republish, which is
// exactly what "Published Date" needs. `updatedAt` already updates on every save.
export function MetadataPanel({ document }) {
  if (!document) {
    return null;
  }

  const hasPublishState = 'publishedAt' in document;

  return {
    title: 'Metadata',
    content: (
      <Flex direction="column" alignItems="stretch" gap={4} width="100%">
        {hasPublishState && (
          <MetadataField
            label="Published Date"
            value={formatDate(document.firstPublishedAt) || 'Not yet published'}
          />
        )}
        <MetadataField label="Last Updated" value={formatDate(document.updatedAt) || '—'} />
      </Flex>
    ),
  };
}

MetadataPanel.type = 'metadata';

export default MetadataPanel;
