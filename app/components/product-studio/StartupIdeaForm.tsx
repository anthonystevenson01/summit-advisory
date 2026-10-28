"use client";

import { useState } from "react";

/**
 * The startup idea form on /product-studio/startups. Posts to
 * /api/ai-studio-request, which stores the submission and emails Anthony;
 * the admin queue at /admin/ai-studio lists them. The route keeps its old
 * name so nothing downstream changes.
 */
export default function StartupIdeaForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [product, setProduct] = useState("");
  const [problem, setProblem] = useState("");
  const [stage, setStage] = useState("");
  const [extra, setExtra] = useState("");
  const [teamMembers, setTeamMembers] = useState([{ name: "", linkedin: "" }]);

  const addMember = () => setTeamMembers([...teamMembers, { name: "", linkedin: "" }]);
  const removeMember = (i: number) => setTeamMembers(teamMembers.filter((_, idx) => idx !== i));
  const updateMember = (i: number, field: "name" | "linkedin", val: string) =>
    setTeamMembers(teamMembers.map((m, idx) => (idx === i ? { ...m, [field]: val } : m)));

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      setSubmitError("Please provide your name and email.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/ai-studio-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          website,
          teamMembers,
          product,
          problem,
          stage,
          extra,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return submitted ? (
      <div className="success-box">
        <h3>Idea Received</h3>
        <p>Thanks for sharing. We&apos;ll review it and come back to you within 3 business days.</p>
      </div>
    ) : (
      <div className="idea-form">
        <div className="form-section-title">About You</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              className="form-input"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="jane@startup.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Website</label>
          <input
            className="form-input"
            placeholder="https://yourproduct.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="form-section-title">Founding Team</div>
        <p className="form-section-note">Add all co-founders — we review the full team before responding.</p>
        {teamMembers.map((member, i) => (
          <div className="team-member-row" key={i}>
            <div className="team-member-fields">
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  placeholder="Co-founder name"
                  value={member.name}
                  onChange={(e) => updateMember(i, "name", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">LinkedIn</label>
                <input
                  className="form-input"
                  placeholder="linkedin.com/in/..."
                  value={member.linkedin}
                  onChange={(e) => updateMember(i, "linkedin", e.target.value)}
                />
              </div>
            </div>
            {teamMembers.length > 1 && (
              <button type="button" className="remove-member-btn" onClick={() => removeMember(i)}>✕</button>
            )}
          </div>
        ))}
        <button type="button" className="add-member-btn" onClick={addMember}>+ Add another team member</button>

        <div className="form-section-title">The Idea</div>
        <div className="form-group">
          <label className="form-label">What&apos;s the product?</label>
          <input
            className="form-input"
            placeholder="One sentence — what are you building?"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">What problem does it solve?</label>
          <textarea
            className="form-textarea"
            placeholder="Who has this problem, how painful is it, and why hasn't it been solved yet?"
            style={{ minHeight: 96 }}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">What&apos;s your current stage?</label>
          <select
            className="form-select"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="">Select one...</option>
            <option>Idea only — nothing built</option>
            <option>Early prototype / MVP</option>
            <option>Live product, pre-revenue</option>
            <option>Live product, early revenue</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Anything else we should know?</label>
          <textarea
            className="form-textarea"
            placeholder="Links, context, timeline — anything relevant."
            style={{ minHeight: 80 }}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </div>
        {submitError && (
          <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>{submitError}</p>
        )}
        <button
          type="button"
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit Your Idea →"}
        </button>
      </div>
  );
}
