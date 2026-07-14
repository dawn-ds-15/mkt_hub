import { useState, useEffect } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import Layout from '../components/Layout';

const SPEC_URL = 'https://mkt-hub.onrender.com/api/docs/swagger-ui-init.js';

export default function ApiDocs() {
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(SPEC_URL);
        const text = await res.text();
        const match = text.match(/"swaggerDoc":\s*(\{[\s\S]*?\}),\s*"customOptions"/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          parsed.servers = [{ url: 'https://mkt-hub.onrender.com' }];
          setSpec(parsed);
        }
      } catch (e) {
        console.error('Failed to load API spec:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Layout title="API Documentation">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden [&_.swagger-ui_.info]:p-6 [&_.swagger-ui_.opblock-tag]:px-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin mr-2">refresh</span>
            Loading API documentation...
          </div>
        ) : spec ? (
          <SwaggerUI spec={spec} deepLinking={true} />
        ) : (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <p className="text-headline-sm font-semibold">Không thể tải tài liệu API</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
