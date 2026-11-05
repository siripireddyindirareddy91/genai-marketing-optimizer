"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="loading-screen">
      <h1>Your workspace hit an unexpected issue.</h1>
      <p>Please retry. Your previously saved records remain in storage.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
