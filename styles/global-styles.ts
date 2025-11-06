/**
 * Global theming and style tokens
 *
 * Provides:
 * - useTheme: minimal color accessors for simple components
 * - SIZES/FONTS: design tokens
 * - useGlobalStyles: memoized StyleSheet with common UI patterns
 *
 * Uses the app's color scheme (light/dark) to switch palettes.
 */
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMemo } from "react";
import { StyleSheet } from "react-native";

export const useTheme = () => {
    const scheme = useColorScheme() ?? "light";
    const isDark = scheme === "dark";
    return {
        background: isDark ? Colors.dark.background : Colors.light.background,
        text: isDark ? Colors.dark.text : Colors.light.text,
        tint: isDark ? Colors.dark.tint : Colors.light.tint,
    };
};

// Internal palette used to generate themed styles
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

export const useGlobalStyles = () => {
    const scheme = useColorScheme() ?? "light";
    const palette = scheme === "dark" ? DARK_COLORS : LIGHT_COLORS;

    // Memoize to avoid re-creating styles on every render; depends on scheme only
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

                // Cards
                card: {
                    backgroundColor: palette.surface,
                    padding: SIZES.md,
                    borderRadius: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: palette.border,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: scheme === "dark" ? 0.3 : 0.1,
                    shadowRadius: 3,
                    elevation: 2,
                },
                cardTitle: {
                    fontSize: 18,
                    fontWeight: "600",
                    color: palette.textPrimary,
                    marginBottom: 4,
                },

                // Layout
                rowContainer: {
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 4,
                },
                metaText: {
                    color: palette.textSecondary,
                    fontSize: 14,
                    marginLeft: 4,
                },

                // Empty States
                emptyContainer: {
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: SIZES.xl,
                },
                emptyIcon: {
                    marginBottom: SIZES.md,
                },
                emptyText: {
                    fontSize: 18,
                    fontWeight: "600",
                    color: palette.textPrimary,
                    marginBottom: SIZES.sm,
                    textAlign: "center",
                },
                emptySubtext: {
                    color: palette.textSecondary,
                    fontSize: 14,
                    textAlign: "center",
                },

                // Lists
                listContainer: {
                    paddingBottom: 20,
                },

                // Sections/Panels
                section: {
                    flex: 1,
                    backgroundColor: palette.surface,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: SIZES.md,
                },
                sectionTitle: {
                    fontSize: 20,
                    fontWeight: "bold",
                    marginBottom: SIZES.sm,
                    color: palette.textPrimary,
                },

                // Expense/Activity Items
                itemCard: {
                    padding: 12,
                    backgroundColor: scheme === "dark" ? "#2c2c2e" : "#f8f9fa",
                    borderRadius: 8,
                    marginBottom: 10,
                    shadowColor: "#000",
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 1,
                },
                itemTitle: {
                    fontSize: 16,
                    fontWeight: "600",
                    color: palette.textPrimary,
                },
                itemSubtitle: {
                    color: palette.textSecondary,
                    fontSize: 14,
                    marginTop: 2,
                },

                // Activity Items
                activityItem: {
                    marginBottom: SIZES.sm,
                    padding: SIZES.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.border,
                },
                activityText: {
                    color: palette.textPrimary,
                    fontSize: 14,
                },
                activityDate: {
                    color: palette.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                },

                // Member Items
                memberCard: {
                    backgroundColor: scheme === "dark" ? "#2c2c2e" : "#f8f9fa",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: SIZES.sm,
                },
                memberName: {
                    fontSize: 16,
                    color: palette.textPrimary,
                },

                // Expense Details
                expenseHeader: {
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: SIZES.lg,
                },
                expenseTitleContainer: {
                    flex: 1,
                },
                expenseAmount: {
                    fontSize: 32,
                    fontWeight: "bold",
                    color: palette.primary,
                },
                infoSection: {
                    marginBottom: SIZES.lg,
                },
                infoRow: {
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 12,
                },
                infoLabel: {
                    fontSize: 14,
                    color: palette.textSecondary,
                    marginLeft: SIZES.sm,
                    flex: 1,
                },
                infoValue: {
                    fontSize: 16,
                    fontWeight: "600",
                    color: palette.textPrimary,
                },
                notesBox: {
                    backgroundColor: scheme === "dark" ? "#2c2c2e" : "#f8f9fa",
                    padding: SIZES.md,
                    borderRadius: 8,
                    marginTop: SIZES.sm,
                },
                notesText: {
                    fontSize: 14,
                    color: palette.textPrimary,
                    lineHeight: 20,
                },
                participantCard: {
                    backgroundColor: scheme === "dark" ? "#2c2c2e" : "#f8f9fa",
                    padding: SIZES.md,
                    borderRadius: 8,
                    marginBottom: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                },
                participantInfo: {
                    flex: 1,
                },
                participantName: {
                    fontSize: 16,
                    fontWeight: "600",
                    color: palette.textPrimary,
                },
                participantEmail: {
                    fontSize: 14,
                    color: palette.textSecondary,
                    marginTop: 2,
                },
                participantAmount: {
                    fontSize: 18,
                    fontWeight: "bold",
                    color: palette.primary,
                },
                paidBadge: {
                    backgroundColor: palette.primary,
                    paddingHorizontal: SIZES.sm,
                    paddingVertical: 4,
                    borderRadius: 4,
                    marginTop: 4,
                },
                paidBadgeText: {
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: "600",
                },
            }),
        [scheme]
    );

    return styles;
};

