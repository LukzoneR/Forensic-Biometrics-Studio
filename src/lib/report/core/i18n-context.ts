import i18n from "@/lib/locales/i18n";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import type { KeywordsT, ReportT } from "./types";

export interface ReportI18nContext {
    tReport: ReportT;
    tKeywords: KeywordsT;
    reportLanguage: string;
}

export const withReportI18n = async <T>(
    optionsLanguage: string | undefined,
    callback: (context: ReportI18nContext) => Promise<T>
): Promise<T> => {
    const previousLanguage = i18n.language;
    let languageChanged = false;

    const reportLanguage =
        optionsLanguage ||
        GlobalSettingsStore.state.settings.language ||
        i18n.language ||
        "pl";

    try {
        if (reportLanguage !== previousLanguage) {
            await i18n.changeLanguage(reportLanguage);
            languageChanged = true;
        }

        await i18n.loadNamespaces(["report", "keywords"]);
        const tReport = i18n.getFixedT(reportLanguage, "report");
        const tKeywords = i18n.getFixedT(reportLanguage, "keywords");

        return await callback({ tReport, tKeywords, reportLanguage });
    } finally {
        if (languageChanged) {
            await i18n.changeLanguage(previousLanguage);
        }
    }
};
