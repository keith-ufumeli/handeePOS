import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useReportStore, ExportReportType, ExportGroupBy } from '../../src/stores/reportStore';

// ── Types ────────────────────────────────────────────────────────────────────

type SortBy = 'sales' | 'revenue';

interface ReportTypeOption {
  value: ExportReportType;
  label: string;
  icon: string;
  description: string;
  hasGroupBy: boolean;
  hasSortBy: boolean;
}

interface DateRangeOption {
  label: string;
  startDate: () => Date;
  endDate: () => Date;
}

interface GroupByOption {
  value: ExportGroupBy;
  label: string;
}

interface SortByOption {
  value: SortBy;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REPORT_TYPES: ReportTypeOption[] = [
  {
    value: 'daily-summary',
    label: 'Daily Summary',
    icon: 'today-outline',
    description: 'Sales overview for a single day',
    hasGroupBy: false,
    hasSortBy: false,
  },
  {
    value: 'sales',
    label: 'Sales Report',
    icon: 'bar-chart-outline',
    description: 'Revenue and order data over a date range',
    hasGroupBy: true,
    hasSortBy: false,
  },
  {
    value: 'products',
    label: 'Product Performance',
    icon: 'pricetag-outline',
    description: 'Top products by quantity sold or revenue',
    hasGroupBy: false,
    hasSortBy: true,
  },
  {
    value: 'inventory',
    label: 'Inventory Valuation',
    icon: 'cube-outline',
    description: 'Current stock levels and values',
    hasGroupBy: false,
    hasSortBy: false,
  },
  {
    value: 'customers',
    label: 'Customer Analytics',
    icon: 'people-outline',
    description: 'Customer spending and loyalty data',
    hasGroupBy: false,
    hasSortBy: false,
  },
];

const DATE_RANGES: DateRangeOption[] = [
  {
    label: 'Today',
    startDate: () => startOfDay(new Date()),
    endDate: () => new Date(),
  },
  {
    label: 'Yesterday',
    startDate: () => {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - 1);
      return d;
    },
    endDate: () => {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - 1);
      d.setHours(23, 59, 59, 999);
      return d;
    },
  },
  {
    label: 'Last 7 days',
    startDate: () => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return startOfDay(d);
    },
    endDate: () => new Date(),
  },
  {
    label: 'Last 30 days',
    startDate: () => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return startOfDay(d);
    },
    endDate: () => new Date(),
  },
  {
    label: 'This month',
    startDate: () => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    },
    endDate: () => new Date(),
  },
  {
    label: 'Last month',
    startDate: () => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth() - 1, 1);
    },
    endDate: () => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59);
    },
  },
  {
    label: 'Last 3 months',
    startDate: () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return startOfDay(d);
    },
    endDate: () => new Date(),
  },
  {
    label: 'This year',
    startDate: () => new Date(new Date().getFullYear(), 0, 1),
    endDate: () => new Date(),
  },
];

const GROUP_BY_OPTIONS: GroupByOption[] = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

const SORT_BY_OPTIONS: SortByOption[] = [
  { value: 'sales', label: 'By Quantity Sold' },
  { value: 'revenue', label: 'By Revenue' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExportReportScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { exportReport, exporting } = useReportStore();

  const [reportType, setReportType] = useState<ExportReportType>('sales');
  const [selectedRangeIndex, setSelectedRangeIndex] = useState(
    () => DATE_RANGES.findIndex(r => r.label === 'Last 30 days')
  );
  const [groupBy, setGroupBy] = useState<ExportGroupBy>('day');
  const [sortBy, setSortBy] = useState<SortBy>('sales');

  const selectedType = REPORT_TYPES.find(t => t.value === reportType)!;
  const selectedRange = DATE_RANGES[selectedRangeIndex];
  const startDate = selectedRange.startDate();
  const endDate = selectedRange.endDate();

  const handleExport = async () => {
    try {
      await exportReport({
        type: reportType,
        startDate: toDateString(startDate),
        endDate: toDateString(endDate),
        groupBy: selectedType.hasGroupBy ? groupBy : undefined,
        sortBy: selectedType.hasSortBy ? sortBy : undefined,
      });
    } catch (err: any) {
      Alert.alert('Export failed', err.message || 'Something went wrong. Please try again.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const styles = useExportStyles(theme);
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Report type */}
        <Text style={styles.sectionLabel}>Report Type</Text>
        <View style={styles.card}>
          {REPORT_TYPES.map((type, index) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeRow,
                index < REPORT_TYPES.length - 1 && styles.typeRowBorder,
                reportType === type.value && styles.typeRowSelected,
              ]}
              onPress={() => setReportType(type.value)}
              activeOpacity={0.7}
            >
              <View style={[styles.typeIcon, reportType === type.value && styles.typeIconSelected]}>
                <Ionicons
                  name={type.icon as any}
                  size={20}
                  color={reportType === type.value ? theme.white : theme.gray500}
                />
              </View>
              <View style={styles.typeText}>
                <Text style={[styles.typeLabel, reportType === type.value && styles.typeLabelSelected]}>
                  {type.label}
                </Text>
                <Text style={styles.typeDesc}>{type.description}</Text>
              </View>
              {reportType === type.value && (
                <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Date range */}
        <Text style={styles.sectionLabel}>Date Range</Text>
        <View style={[styles.card, styles.chipContainer]}>
          {DATE_RANGES.map((range, index) => (
            <TouchableOpacity
              key={range.label}
              style={[styles.chip, selectedRangeIndex === index && styles.chipSelected]}
              onPress={() => setSelectedRangeIndex(index)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selectedRangeIndex === index && styles.chipTextSelected]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Group By — only for Sales report */}
        {selectedType.hasGroupBy && (
          <>
            <Text style={styles.sectionLabel}>Group By</Text>
            <View style={[styles.card, styles.chipContainer]}>
              {GROUP_BY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, groupBy === opt.value && styles.chipSelected]}
                  onPress={() => setGroupBy(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, groupBy === opt.value && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Sort By — only for Products report */}
        {selectedType.hasSortBy && (
          <>
            <Text style={styles.sectionLabel}>Sort By</Text>
            <View style={[styles.card, styles.chipContainer]}>
              {SORT_BY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, sortBy === opt.value && styles.chipSelected]}
                  onPress={() => setSortBy(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, sortBy === opt.value && styles.chipTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Ionicons name="document-text-outline" size={18} color={theme.primary} />
          <Text style={styles.summaryText}>
            Exporting{' '}
            <Text style={styles.summaryBold}>{selectedType.label}</Text>
            {' '}as CSV —{' '}
            <Text style={styles.summaryBold}>{selectedRange.label}</Text>
            {'\n'}
            <Text style={styles.summaryDates}>
              {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
            </Text>
          </Text>
        </View>

        {/* Export button */}
        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.8}
        >
          {exporting ? (
            <>
              <ActivityIndicator size="small" color={theme.white} />
              <Text style={styles.exportButtonText}>Preparing export…</Text>
            </>
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color={theme.white} />
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function useExportStyles(theme: typeof Colors.light) {
  return useMemo(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: theme.cardBg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  typeRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  typeRowSelected: {
    backgroundColor: theme.infoBg,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconSelected: {
    backgroundColor: theme.primary,
  },
  typeText: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  typeLabelSelected: {
    color: theme.primary,
  },
  typeDesc: {
    fontSize: 13,
    color: theme.gray400,
    marginTop: 2,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.gray100,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.gray700,
  },
  chipTextSelected: {
    color: theme.white,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.infoBg,
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
    gap: 10,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: theme.gray700,
    lineHeight: 20,
  },
  summaryBold: {
    fontWeight: '700',
    color: theme.primaryDark,
  },
  summaryDates: {
    fontSize: 13,
    color: theme.gray500,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
    gap: 10,
  },
  exportButtonDisabled: {
    backgroundColor: theme.infoBg,
  },
  exportButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.white,
  },
  }), [theme]);
}
