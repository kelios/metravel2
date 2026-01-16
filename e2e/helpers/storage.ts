export const seedNecessaryConsent = () => {
  try {
    window.localStorage.setItem(
      'metravel_consent_v1',
      JSON.stringify({ necessary: true, analytics: false, date: new Date().toISOString() })
    );
  } catch {
    // ignore
  }
};

export const hideRecommendationsBanner = () => {
  try {
    window.sessionStorage.setItem('recommendations_visible', 'false');
  } catch {
    // ignore
  }
};
