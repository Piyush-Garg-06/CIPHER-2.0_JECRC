import React, { useState } from 'react';
import { 
  Play, 
  BookOpen, 
  Clock, 
  User, 
  Tag, 
  CheckCircle2, 
  X, 
  Share2, 
  Bookmark,
  Sparkles,
  Video
} from 'lucide-react';
import { HEALTH_MAGAZINE_DATA } from '../services/magazineData';

export default function HealthMagazineView({ patient }) {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const data = HEALTH_MAGAZINE_DATA;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Condition-Specific Health Magazine & Video Knowledge Hub
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Clinical educational tutorials & lifestyle guidelines tailored to your cardiovascular state
          </p>
        </div>

        <span style={{
          fontSize: '0.75rem',
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--primary-blue-subtle)',
          color: 'var(--primary-blue)',
          fontWeight: 600
        }}>
          Condition: {data.featuredCondition}
        </span>
      </div>

      {/* SECTION 1: VIDEO TUTORIALS FORMAT (User diagram requirement: "Knowledge tutorial vdo format") */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <Video size={18} color="var(--primary-blue)" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Clinical Video Tutorials & Patient Walkthroughs
          </h2>
        </div>

        <div className="grid-2">
          {data.videoTutorials.map(vdo => (
            <div
              key={vdo.id}
              className="clean-card"
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
              onClick={() => setSelectedVideo(vdo)}
            >
              {/* Thumbnail with Play Overlay */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '180px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: '#0f172a'
              }}>
                <img
                  src={vdo.thumbnail}
                  alt={vdo.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                />

                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(2, 132, 199, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                    transition: 'transform var(--transition)'
                  }}>
                    <Play size={20} fill="#fff" style={{ marginLeft: 3 }} />
                  </div>
                </div>

                <span style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  color: '#ffffff',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600
                }}>
                  {vdo.duration}
                </span>
              </div>

              {/* Title & Metadata */}
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--primary-blue)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {vdo.category}
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px', lineHeight: 1.35 }}>
                  {vdo.title}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, marginTop: '4px' }}>
                  {vdo.description}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', paddingTop: '0.4rem', borderTop: '1px solid #f1f5f9' }}>
                <span>Instructor: <strong>{vdo.instructor}</strong></span>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>Watch Tutorial ➔</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ONLINE MAGAZINE ARTICLES (User diagram requirement: "ONLINE MAGAZINE RELEVANT TO HEALTH CONDITION") */}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <BookOpen size={18} color="var(--primary-blue)" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Cardiovascular Health Magazine Articles
          </h2>
        </div>

        <div className="grid-3">
          {data.magazineArticles.map(art => (
            <div
              key={art.id}
              className="clean-card"
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onClick={() => setSelectedArticle(art)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.7rem', background: 'var(--primary-blue-subtle)', color: 'var(--primary-blue)', padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                    {art.category}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {art.readTime}
                  </span>
                </div>

                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.35, marginTop: '0.35rem' }}>
                  {art.title}
                </h3>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '0.45rem' }}>
                  {art.summary}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Source: {art.author}</span>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>Read Article ➔</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Video Modal Player */}
      {selectedVideo && (
        <div className="modal-overlay-light" onClick={() => setSelectedVideo(null)}>
          <div className="modal-content-light" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--primary-blue)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {selectedVideo.category} &bull; {selectedVideo.duration}
                </span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  {selectedVideo.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedVideo(null)}
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

            {/* Interactive Embedded YouTube Player */}
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: 'var(--radius-md)',
              background: '#000000',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
            }}>
              {selectedVideo.youtubeId ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1&rel=0`}
                  title={selectedVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  style={{ border: 'none', display: 'block' }}
                />
              ) : (
                <img
                  src={selectedVideo.thumbnail}
                  alt={selectedVideo.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>

            {/* Video Description & Watch on YouTube Link */}
            {selectedVideo.description && (
              <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, flex: 1 }}>
                  {selectedVideo.description}
                </p>
                {selectedVideo.youtubeUrl && (
                  <a
                    href={selectedVideo.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--primary-blue)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Open on YouTube ↗
                  </a>
                )}
              </div>
            )}

            {/* Key Clinical Takeaways */}
            <div style={{ marginTop: '1.25rem', background: 'var(--bg-card-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Key Clinical Takeaways:
              </div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {selectedVideo.keyTakeaways?.map((takeaway, idx) => (
                  <li key={idx}>{takeaway}</li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn-clean btn-clean-primary" onClick={() => setSelectedVideo(null)}>
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Article Modal */}
      {selectedArticle && (
        <div className="modal-overlay-light" onClick={() => setSelectedArticle(null)}>
          <div className="modal-content-light" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--primary-blue)', fontWeight: 700 }}>
                  {selectedArticle.category} &bull; {selectedArticle.readTime}
                </span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                  {selectedArticle.title}
                </h2>
              </div>

              <button
                onClick={() => setSelectedArticle(null)}
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

            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6, marginBottom: '1rem' }}>
              {selectedArticle.summary}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
              {selectedArticle.tags?.map(t => (
                <span key={t} style={{ fontSize: '0.72rem', background: '#f1f5f9', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                  #{t}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-clean btn-clean-primary" onClick={() => setSelectedArticle(null)}>
                Done Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
