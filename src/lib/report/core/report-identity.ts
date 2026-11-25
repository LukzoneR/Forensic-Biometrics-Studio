import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { GlobalSettingsStore } from "@/lib/stores/GlobalSettings";
import { formatReportDateTime, md5String } from "../report-utils";
import type { ImageMeta, ReportIdentity, ReportMetadataOptions } from "./types";

export const decodeUnicodeEscapes = (value: string): string =>
    value.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );

export const getSystemId = async (): Promise<string> => {
    try {
        const id = await invoke<string>("get_machine_id");
        return id || "unknown";
    } catch {
        return "unknown";
    }
};

export const buildReportIdentity = async (
    options: ReportMetadataOptions,
    leftMeta: ImageMeta,
    rightMeta: ImageMeta
): Promise<ReportIdentity> => {
    const reportSettings = GlobalSettingsStore.state.settings.report;
    const reportDateTime =
        options.reportDateTime?.trim() || formatReportDateTime(new Date());
    const systemId = await getSystemId();

    const reportId = md5String(
        [
            reportDateTime,
            leftMeta.sizeBytes,
            leftMeta.checksum,
            rightMeta.sizeBytes,
            rightMeta.checksum,
            systemId,
        ].join("|")
    );

    const performedBy = decodeUnicodeEscapes(
        options.performedBy?.trim() || reportSettings?.performedBy || "-"
    );
    const department = decodeUnicodeEscapes(
        options.department?.trim() || reportSettings?.department || "-"
    );

    const addressFallback = [
        reportSettings?.addressLine1,
        reportSettings?.addressLine2,
        reportSettings?.addressLine3,
        reportSettings?.addressLine4,
    ]
        .map(line => line?.trim())
        .filter(Boolean) as string[];

    const addressLines =
        options.addressLines?.map(line => line.trim()).filter(Boolean) ?? [];

    const address = (
        addressLines.length > 0 ? addressLines : addressFallback
    ).map(line => decodeUnicodeEscapes(line));

    const appVersion = await getVersion();

    return {
        reportId,
        reportDateTime,
        performedBy,
        department,
        address,
        appVersion,
    };
};
