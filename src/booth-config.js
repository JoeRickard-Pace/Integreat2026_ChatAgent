const boothEnv = import.meta.env || {};

window.BOOTH_CFG = {
  bookingUrl: 'mailto:connect@paceintegration.com?subject=Pre-flight%20check',
  liveDataUrl: boothEnv.VITE_GETSTATES_API_URL || boothEnv.GETSTATES_API_URL || '/states-data',
  liveDataToken: boothEnv.VITE_GETSTATES_API_KEY || boothEnv.GETSTATES_API_KEY || '',
  award: false,
};
