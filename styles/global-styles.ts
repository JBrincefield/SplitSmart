import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMemo } from "react";
import { StyleSheet } from "react-native";

// Optional: keep this simple theme utility for ad-hoc usage
export const useTheme = () => {
    const scheme = useColorScheme() ?? "light";
    const isDark = scheme === "dark";
    return {
        background: isDark ? Colors.dark.background : Colors.light.background,
        text: isDark ? Colors.dark.text : Colors.light.text,
        tint: isDark ? Colors.dark.tint : Colors.light.tint,
    };
};

type Palette = {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    danger: string;
    success: string;
};

const LIGHT_COLORS: Palette = {
    primary: Colors.light.tint,
    secondary: "#6c757d",
    background: Colors.light.background,
    surface: "#ffffff",
    textPrimary: Colors.light.text,
    textSecondary: "#6c757d",
    border: "#dee2e6",
    danger: "#dc3545",
    success: "#28a745",
};

const DARK_COLORS: Palette = {
    primary: Colors.light.tint,
    secondary: "#9BA1A6",
    background: Colors.dark.background,
    surface: "#1c1c1e",
    textPrimary: Colors.dark.text,
    textSecondary: "#9BA1A6",
    border: "#2b2d31",
    danger: "#ff6b6b",
    success: "#34c759",
};

export const SIZES = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const FONTS = {
    regular: {
        fontFamily: "System",
        fontWeight: "400" as const,
    },
    bold: {
        fontFamily: "System",
        fontWeight: "700" as const,
    },
};

// New: hook to get dynamic styles based on current color scheme
export const useGlobalStyles = () => {
    const scheme = useColorScheme() ?? "light";
    const palette = scheme === "dark" ? DARK_COLORS : LIGHT_COLORS;

    const styles = useMemo(
        () =>
            StyleSheet.create({
                // Containers
                container: {
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: SIZES.lg,
                    backgroundColor: palette.background,
                },
                screen: {
                    flex: 1,
                    padding: SIZES.lg,
                    backgroundColor: palette.background,
                },

                // Text
                title: {
                    ...FONTS.bold,
                    fontSize: 28,
                    textAlign: "center",
                    color: palette.textPrimary,
                    marginBottom: SIZES.lg,
                },
                subtitle: {
                    ...FONTS.regular,
                    fontSize: 16,
                    color: palette.textSecondary,
                    textAlign: "center",
                    marginBottom: SIZES.md,
                },
                label: {
                    ...FONTS.bold,
                    fontSize: 16,
                    color: palette.textPrimary,
                    marginBottom: SIZES.sm,
                },

                // Inputs
                input: {
                    borderWidth: 1,
                    borderColor: palette.border,
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 16,
                    backgroundColor: palette.surface,
                    color: palette.textPrimary,
                    width: "100%",
                    marginBottom: SIZES.md,
                },

                // Buttons
                button: {
                    backgroundColor: palette.primary,
                    borderRadius: 10,
                    paddingVertical: SIZES.md,
                    paddingHorizontal: SIZES.lg,
                    alignItems: "center",
                    marginVertical: SIZES.sm,
                },
                buttonText: {
                    color: "#fff",
                    fontSize: 16,
                    ...FONTS.bold,
                },
                linkText: {
                    color: palette.primary,
                    fontSize: 14,
                    textAlign: "center",
                    marginTop: SIZES.sm,
                },
            }),
        [scheme]
    );

    return styles;
};

