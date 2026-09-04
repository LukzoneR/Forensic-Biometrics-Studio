import { useEffect } from "react";
import {
    CustomThemeStore,
    CustomTheme,
    ThemeColors,
    deriveSelectedRowColors,
} from "@/lib/stores/CustomTheme";

const SELECTED_CSS_VARS = ["--selected", "--selected-foreground"] as const;

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
        SELECTED_CSS_VARS.forEach(cssVar => {
            root.style.removeProperty(cssVar);
        });
        return;
    }

    Object.entries(CSS_VAR_MAP).forEach(([key, cssVar]) => {
        const colorKey = key as keyof ThemeColors;
        // eslint-disable-next-line security/detect-object-injection
        const value = theme.colors[colorKey];
        if (value) {
            root.style.setProperty(cssVar, value);
        }
    });

    const selected = deriveSelectedRowColors(theme.colors.card);
    root.style.setProperty("--selected", selected.selected);
    root.style.setProperty(
        "--selected-foreground",
        selected.selectedForeground
    );
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
