// helper function to console.log messages only when "debug mode" is turned on
// "debug mode" is a key in extension local storage
// TODO: build the UI to set this key in Claire options
chrome.storage.local.set({ debug: true });
const debug_log = (message) => {
  chrome.storage.local.get("debug").then((result) => {
    if (result.debug) {
      console.log("[DEBUG] ", message);
    }
  });
};

class RequestInfo {
  constructor(
    tabId,
    requestId,
    url,
    ipAddress,
    serverHeaderValue,
    cloudflareRayHeaderValue,
  ) {
    this.tabId = tabId;
    this.requestId = requestId;
    this.url = url;
    this.ipAddress = ipAddress;
    this.serverHeaderValue = serverHeaderValue;
    this.cloudflareRayHeaderValue = cloudflareRayHeaderValue;
    // TODO: get this
    // this.httpProtocolVersion = httpProtocolVersion;
    this.servedByCloudflare =
      this.serverHeaderValue &&
      this.serverHeaderValue.toLowerCase() === "cloudflare";
  }
}

// given an array of objects each with `name` and `value` keys holding header info
// find the value of the header specified by headerName
// structure of responseHeaders is expected to be as stored in `details` of chrome.webRequest.onCompleted callback
const getHeaderValue = (responseHeaders, headerName) => {
  const headerObject = responseHeaders.find(
    (header) => header.name.toLowerCase() === headerName,
  );
  if (headerObject) {
    return headerObject["value"];
  }
};

// to convert the details object that is received by a chrome.webRequest.onCompleted callback
// into a lighter version that has basic information about the request
const convertDetailsToRequestInfo = (details) => {
  const serverHeaderValue = getHeaderValue(details.responseHeaders, "server");
  const cloudflareRayHeaderValue = getHeaderValue(
    details.responseHeaders,
    "cf-ray",
  );
  return new RequestInfo(
    details.tabId,
    details.requestId,
    details.url,
    details.ip,
    serverHeaderValue,
    cloudflareRayHeaderValue,
  );
};

// a mapping of tab IDs to request details object lives in chrome.storage.local
// this function helps generate the key for it
// NOTE: this is duplicated in popup.js
// TODO: switch to message passing to keep this in one place
const getStorageKeyForTab = (tabId) => {
  return `tab-request-details-${tabId}`;
};

// requestInfo
const setIconForTab = async (requestInfo) => {
  const path = requestInfo.servedByCloudflare
    ? "/icons/cloud-orange-32px.png"
    : "/icons/cloud-grey-32px.png";
  const tabId = requestInfo.tabId;
  // tabId is -1 for chrome extension pages like page action popups
  // they have a URLs of type "chrome-extension://<extension-id>/popup.html"
  if (tabId >= 0) {
    debug_log(
      `setting icon for tab ${tabId} to ${path} for url ${requestInfo.url}`,
    );
    await chrome.action.setIcon({ path: path, tabId: tabId });
    debug_log(
      `set icon for tab ${tabId} to ${path} for url ${requestInfo.url}`,
    );
  } else {
    debug_log(
      `Skipped setting icon for page action, url is ${requestInfo.url}`,
    );
  }
  // TODO: make this debug only
  debug_log(
    `Served by cloudflare ${requestInfo.servedByCloudflare}. Header value is ${requestInfo.serverHeaderValue}. In tab ${tabId} website is ${requestInfo.url}`,
  );
};

const processWebRequestCompleted = async (details) => {
  const requestInfo = convertDetailsToRequestInfo(details);
  await processEvent(requestInfo, "webRequest.onCompleted");
};

const processWebNavigationonDOMContentLoaded = async (details) => {
  // skip events when it's not the main frame
  if (details.frameId !== 0) {
    // debug_log(
    //   `Skipping processWebNavigationonDOMContentLoaded for non-main frame ${details.frameId} in tab ${details.tabId}`,
    // );
    return;
  }
  // use the tab ID to lookup the request info from storage because
  // navigation events don't have enough info (eg. responseHeaders); this assumes webRequest
  // completed and stored request info before this navigation event is processed
  const storageKey = getStorageKeyForTab(details.tabId);
  const result = await chrome.storage.local.get(storageKey);
  if (result != undefined) {
    const requestInfo = result[storageKey];
    if (requestInfo == undefined) {
      debug_log(
        `Could not find request data in storage local for tab ${details.tabId}`,
      );
      return;
    }
    // await processEvent(requestInfo, "webNavigation.onDOMContentLoaded");
    await setIconForTab(requestInfo);
  }
};

// process web request / web navigation events and set an icon for the tab
const processEvent = async (requestInfo, eventType) => {
  const storageKey = getStorageKeyForTab(requestInfo.tabId);
  await chrome.storage.local.set({ [storageKey]: requestInfo });
  debug_log(`--- ${eventType}, will call set icon ---`);
  debug_log(requestInfo);
  await setIconForTab(requestInfo);
};

const filter = {
  urls: ["<all_urls>"],
  types: ["main_frame"],
};

const extraInfoSpec = ["responseHeaders"];

// listeb to web request events and act on them to set icon
// this carries information about the request, including response headers
chrome.webRequest.onCompleted.addListener(
  processWebRequestCompleted,
  filter,
  extraInfoSpec,
);

// listen to web navigation events and act on them to set icon
// the information passed to the callback is limited (eg. missing response headers)
// but it helps with cases when there are navigation events (eg. back button pressed etc.) or other
// pre-render optimizations that would not map well to webRequest events, so this helps close
// the gap in being able to set the icon more reliably in these cases
chrome.webNavigation.onDOMContentLoaded.addListener(
  processWebNavigationonDOMContentLoaded,
);

chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
  debug_log(`Tab replaced, removed: ${removedTabId} added ${addedTabId}`);
  const storageKeyForAddedTab = getStorageKeyForTab(addedTabId);
  const storageKeyForRemovedTab = getStorageKeyForTab(removedTabId);
  const storedValueForRemovedTab = await chrome.storage.local.get(
    storageKeyForRemovedTab,
  );
  const requestInfo = storedValueForRemovedTab[storageKeyForRemovedTab];
  await chrome.storage.local.set({ [storageKeyForAddedTab]: requestInfo });
  await chrome.storage.local.remove(storageKeyForRemovedTab);
});

// clear request data when tabs are destroyed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  debug_log(`Tab removed ${tabId}`);
  await chrome.storage.local.remove(getStorageKeyForTab(tabId));
});
