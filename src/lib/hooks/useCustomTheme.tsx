import { useEffect } from "react";
import {
    CustomThemeStore,
    CustomTheme,
    ThemeColors,
} from "@/lib/stores/CustomTheme";

function parseHsl(value: string): [number, number, number] {
    const [h, s, l] = value.split(" ");
    return [
        parseFloat(h ?? "0") || 0,
        parseFloat(s ?? "0") || 0,
        parseFloat(l ?? "0") || 0,
    ];
}

function computeTableRowSelectedColors(
    card: string,
    baseTheme: CustomTheme["baseTheme"]
): { selected: string; foreground: string } {
    const [h, s, cardLightness] = parseHsl(card);

    if (baseTheme === "light") {
        const selectedLightness = Math.max(30, cardLightness - 48);
        return {
            selected: `${h} ${Math.min(s + 5, 70)}% ${selectedLightness}%`,
            foreground: `${h} 30% 95%`,
        };
    }

    const selectedLightness = Math.min(65, cardLightness + 28);
    return {
        selected: `${h} 45% ${selectedLightness}%`,
        foreground: `${h} 31% 97.8%`,
    };
}

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
    primary: "--primary",
    secondary: "--secondary",
    background: "--background",
    foreground: "--foreground",
    card: "--card",
    cardForeground: "--card-foreground",
    popover: "--popover",
    popoverForeground: "--popover-foreground",
    muted: "--muted",
    mutedForeground: "--muted-foreground",
    accent: "--accent",
    accentForeground: "--accent-foreground",
    border: "--border",
    input: "--input",
    ring: "--ring",
    destructive: "--destructive",
    destructiveForeground: "--destructive-foreground",
};

export function applyCustomTheme(theme: CustomTheme | null) {
    const root = document.documentElement;

    if (!theme) {
        Object.values(CSS_VAR_MAP).forEach(cssVar => {
            root.style.removeProperty(cssVar);
        });
        root.style.removeProperty("--table-row-selected");
        root.style.removeProperty("--table-row-selected-foreground");
        return;
    }

    const tableRowSelected = computeTableRowSelectedColors(
        theme.colors.card,
        theme.baseTheme
    );
    root.style.setProperty(
        "--table-row-selected",
        tableRowSelected.selected
    );
    root.style.setProperty(
        "--table-row-selected-foreground",
        tableRowSelected.foreground
    );

    Object.entries(CSS_VAR_MAP).forEach(([key, cssVar]) => {
        const colorKey = key as keyof ThemeColors;
        // eslint-disable-next-line security/detect-object-injection
        const value = theme.colors[colorKey];
        if (value) {
            root.style.setProperty(cssVar, value);
        }
    });
}

export function useCustomTheme() {
    const activeThemeId = CustomThemeStore.use(state => state.activeThemeId);
    const themes = CustomThemeStore.use(state => state.themes);

    const activeTheme = activeThemeId
        ? themes.find(t => t.id === activeThemeId) ?? null
        : null;

    useEffect(() => {
        applyCustomTheme(activeTheme);
    }, [activeTheme]);

    return {
        activeTheme,
        activeThemeId,
        themes,
        setActiveTheme: CustomThemeStore.actions.setActiveTheme,
        addTheme: CustomThemeStore.actions.addTheme,
        removeTheme: CustomThemeStore.actions.removeTheme,
        updateTheme: CustomThemeStore.actions.updateTheme,
        updateThemeColor: CustomThemeStore.actions.updateThemeColor,
    };
}
