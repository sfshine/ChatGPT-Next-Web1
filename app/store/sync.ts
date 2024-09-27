import { getClientConfig } from "../config/client";
import { Updater } from "../typing";
import {ApiPath, DEFAULT_MODELS, STORAGE_KEY, StoreKey} from "../constant";
import { createPersistStore } from "../utils/store";
import {
  AppState,
  getLocalAppState,
  GetStoreState,
  mergeAppState,
  setLocalAppState,
} from "../utils/sync";
import { downloadAs, readFromFile } from "../utils";
import { showToast } from "../components/ui-lib";
import Locale from "../locales";
import { createSyncClient, ProviderType } from "../utils/cloud";
import { corsPath } from "../utils/cors";
import moment from 'moment';

export interface WebDavConfig {
  server: string;
  username: string;
  password: string;
}

const isApp = !!getClientConfig()?.isApp;
export type SyncStore = GetStoreState<typeof useSyncStore>;

const DEFAULT_SYNC_STATE = {
  provider: ProviderType.WebDAV,
  useProxy: true,
  proxyUrl: corsPath(ApiPath.Cors),

  webdav: {
    endpoint: "",
    username: "",
    password: "",
  },

  upstash: {
    endpoint: "",
    username: STORAGE_KEY,
    apiKey: "",
  },

  lastSyncTime: 0,
  lastProvider: "",
  monthStr :"",
};

export const useSyncStore = createPersistStore(
  DEFAULT_SYNC_STATE,
  (set, get) => ({
    setMonthStr(monthStr: string) {
        set({ monthStr: monthStr });
    },
    getFileName() {
      const monthStr = get().monthStr || `${moment().format("YYYYMM")}`
      return `${STORAGE_KEY}/backup_${monthStr}.json`;
    },
    cloudSync() {
      const config = get()[get().provider];
      return Object.values(config).every((c) => c.toString().length > 0);
    },

    markSyncTime() {
      set({ lastSyncTime: Date.now(), lastProvider: get().provider });
    },

    export() {
      const state = getLocalAppState();
      const datePart = isApp
        ? `${new Date().toLocaleDateString().replace(/\//g, "_")} ${new Date()
            .toLocaleTimeString()
            .replace(/:/g, "_")}`
        : new Date().toLocaleString();

      const fileName = `Backup-${datePart}.json`;
      downloadAs(JSON.stringify(state), fileName);
    },

    async import() {
      const rawContent = await readFromFile();

      try {
        const remoteState = JSON.parse(rawContent) as AppState;
        const localState = getLocalAppState();
        mergeAppState(localState, remoteState);
        setLocalAppState(localState);
        location.reload();
      } catch (e) {
        console.error("[Import]", e);
        showToast(Locale.Settings.Sync.ImportFailed);
      }
    },

    getClient() {
      const provider = get().provider;
      const client = createSyncClient(provider, get());
      return client;
    },
    /**
     * @param force 0 merge, 1 清空云端 2 清空本地
     */
    async sync(force?: number) {
      const localState = getLocalAppState();
      if (force == 2) {
        (localState["chat-next-web-store"] as any)["sessions"] = [];
        (localState["mask-store"] as any)["masks"] = [];
        (localState["app-config"] as any) = { ...(localState["app-config"]), lastUpdateTime: Infinity };
      }
      const provider = get().provider;
      const config = get()[provider];
      const client = this.getClient();

      try {
        const remoteState = (force == 1 ? {} : JSON.parse(
          await client.get(this.getFileName()),
        )) as AppState;
        mergeAppState(localState, remoteState);
        (localState["app-config"] as any) = { ...(localState["app-config"]), models: DEFAULT_MODELS };
        setLocalAppState(localState);
        console.log("localState", localState)
      } catch (e) {
        console.log("[Sync] failed to get remote state", e);
      }
      await client.set(this.getFileName(), JSON.stringify(localState));

      this.markSyncTime();
    },

    async check() {
      const client = this.getClient();
      return await client.check();
    },
  }),
  {
    name: StoreKey.Sync,
    version: 1.1,

    migrate(persistedState, version) {
      const newState = persistedState as typeof DEFAULT_SYNC_STATE;

      if (version < 1.1) {
        newState.upstash.username = STORAGE_KEY;
      }

      return newState as any;
    },
  },
);
