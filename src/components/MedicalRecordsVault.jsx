import React, { useState } from 'react';
import { 
  FolderArchive, 
  Search, 
  Eye, 
  Download, 
  Building2, 
  X, 
  Tag 
} from 'lucide-react';

export default function MedicalRecordsVault({ records = [], patient }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activePreviewDoc, setActivePreviewDoc] = useState(null);

  const categories = ['All', 'Clinical Reports', 'Lab Reports', 'Imaging', 'Doctor Notes'];

  const filteredRecords = records.filter(rec => {
    const matchesSearch = 
      rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || rec.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="clean-card">
      {/* Header */}
      <div className="clean-card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-blue-subtle)',
            color: 'var(--primary-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderArchive size={18} />
          </div>
          <div>
            <div className="clean-card-title">
              EHR Diagnostic Documentation & Vault
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Integrated clinical documentation, Holter traces, labs & imaging
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.6rem 0.45rem 2rem',
              borderRadius: 'var(--radius-md)',
              background: '#f8fafc',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.25rem' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: selectedCategory === cat ? 'var(--primary-blue-subtle)' : '#f8fafc',
              color: selectedCategory === cat ? 'var(--primary-blue)' : 'var(--text-muted)',
              border: selectedCategory === cat ? '1px solid var(--primary-blue)' : '1px solid var(--border-light)',
              cursor: 'pointer'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Records Cards Grid */}
      <div className="grid-2">
        {filteredRecords.map(rec => (
          <div
            key={rec.id}
            onClick={() => setActivePreviewDoc(rec)}
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all var(--transition)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-blue)';
              e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-blue-subtle)',
                color: 'var(--primary-blue)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600
              }}>
                {rec.category}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {rec.date}
              </span>
            </div>

            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              {rec.title}
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {rec.summary}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <Building2 size={12} /> {rec.facility}
              </div>
              <span style={{ color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Eye size={13} /> View Document
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Document Preview Modal */}
      {activePreviewDoc && (
        <div className="modal-overlay-light" onClick={() => setActivePreviewDoc(null)}>
          <div className="modal-content-light" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-blue-subtle)',
                  color: 'var(--primary-blue)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600
                }}>
                  {activePreviewDoc.category} &bull; {activePreviewDoc.fileType}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                  {activePreviewDoc.title}
                </h3>
              </div>

              <button
                onClick={() => setActivePreviewDoc(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              lineHeight: 1.6,
              color: 'var(--text-main)',
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto',
              marginBottom: '1rem'
            }}>
              {activePreviewDoc.content || activePreviewDoc.summary}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button className="btn-clean btn-clean-secondary" onClick={() => alert(`Exporting ${activePreviewDoc.title} (PDF)...`)}>
                <Download size={13} /> Export PDF
              </button>
              <button className="btn-clean btn-clean-primary" onClick={() => setActivePreviewDoc(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
