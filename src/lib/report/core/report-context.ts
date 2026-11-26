import i18n from "@/lib/locales/i18n";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import type { KeywordsT, ReportT } from "./types";

export type ReportExecutionContext = {
    tReport: ReportT;
    tKeywords: KeywordsT;
    reportLanguage: string;
    setStage: (stageName: string) => void;
};

export type ReportContextOptions = {
    reportLanguage?: string;
    logPrefix?: string;
};

export const runWithReportContext = async <T>(
    options: ReportContextOptions,
    execute: (context: ReportExecutionContext) => Promise<T>
): Promise<T> => {
    let stage = "init";
    const previousLanguage = i18n.language;
    let languageChanged = false;

    const setStage = (newStage: string) => {
        stage = newStage;
    };

    try {
        setStage("prepare-language");
        const reportLanguage =
            options.reportLanguage ||
            GlobalSettingsStore.state.settings.language ||
            i18n.language ||
            "pl";

        if (reportLanguage !== previousLanguage) {
            await i18n.changeLanguage(reportLanguage);
            languageChanged = true;
        }

        await i18n.loadNamespaces(["report", "keywords"]);
        const tReport = i18n.getFixedT(reportLanguage, "report") as ReportT;
        const tKeywords = i18n.getFixedT(
            reportLanguage,
            "keywords"
        ) as KeywordsT;

        return await execute({
            tReport,
            tKeywords,
            reportLanguage,
            setStage,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const prefix = options.logPrefix ?? "report";
        // eslint-disable-next-line no-console
        console.error(`[${prefix}] failed at ${stage}: ${message}`, error);
        throw new Error(`Report failed at ${stage}: ${message}`);
    } finally {
        if (languageChanged) {
            await i18n.changeLanguage(previousLanguage);
        }
    }
};
