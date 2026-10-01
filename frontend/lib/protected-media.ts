export interface ProtectedImageState {
  source: string;
  url: string;
  error: boolean;
}

export function stateForProtectedSource(
  settled: ProtectedImageState,
  source: string,
): ProtectedImageState {
  return settled.source === source
    ? settled
    : { source, url: "", error: false };
}

export interface ProtectedAssetOpening<Tab, Asset> {
  openBlank: () => Tab | null;
  detachOpener: (tab: Tab) => void;
  prepare: (tab: Tab) => void;
  fetch: () => Promise<Asset>;
  createUrl: (asset: Asset) => string;
  navigate: (tab: Tab, url: string) => void;
  close: (tab: Tab) => void;
  download: (url: string) => void;
  revokeLater: (url: string) => void;
}

export async function openFetchedProtectedAsset<Tab, Asset>(
  opening: ProtectedAssetOpening<Tab, Asset>,
): Promise<"preview" | "download"> {
  // This must happen before the first await so browsers retain the click gesture.
  const tab = opening.openBlank();
  if (tab) {
    opening.detachOpener(tab);
    opening.prepare(tab);
  }
  try {
    const asset = await opening.fetch();
    const url = opening.createUrl(asset);
    if (tab) opening.navigate(tab, url);
    else opening.download(url);
    opening.revokeLater(url);
    return tab ? "preview" : "download";
  } catch (error) {
    if (tab) opening.close(tab);
    throw error;
  }
}
