
export const AUTH_FAILURE_EVENT = "gmaps-auth-failure";

let loading = null;
let rejected = false;

export const authFailed = () => rejected;

export function loadGoogleMaps(apiKey) {
  if (loading) return loading;

  // Already on the page (for example after a hot reload): reuse it instead of adding a second script
  if (window.google?.maps?.importLibrary) {
    loading = window.google.maps.importLibrary("marker").then(({ AdvancedMarkerElement }) => ({
      maps: window.google.maps,
      AdvancedMarkerElement,
    }));
    return loading;
  }

  loading = new Promise((resolve, reject) => {
    window.gm_authFailure = () => {
      rejected = true;
      window.dispatchEvent(new Event(AUTH_FAILURE_EVENT));
    };
    window.__memoraMapsReady = async () => {
      try {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");
        resolve({ maps: window.google.maps, AdvancedMarkerElement });
      } catch (e) {
        loading = null;
        reject(e);
      }
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&v=weekly&libraries=marker&callback=__memoraMapsReady`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("The Google Maps script could not be loaded."));
    };
    document.head.appendChild(script);
  });
  return loading;
}