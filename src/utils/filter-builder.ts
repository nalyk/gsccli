import type {
  DimensionFilter,
  DimensionFilterGroup,
  DimensionFilterOperator,
  SearchAnalyticsDimension,
} from '../types/searchconsole.js';

const VALID_DIMENSIONS: SearchAnalyticsDimension[] = [
  'query',
  'page',
  'country',
  'device',
  'date',
  'searchAppearance',
];

const SHORTHAND_TO_GSC: Record<string, DimensionFilterOperator> = {
  '==': 'equals',
  '!=': 'notEquals',
  '~=': 'contains',
  '!~=': 'notContains',
  '=~': 'includingRegex',
  '!~': 'excludingRegex',
};

// Operator alternation MUST be longest-first. Otherwise `query!~=brand` is parsed as `!~`
// (excludingRegex) plus value `=brand`, silently changing the filter semantics.
const OPERATOR_ALT_REGEX = /^(\w+)(!~=|!~|=~|~=|!=|==)(.+)$/;

export function parseFilterString(filterStr: string): DimensionFilter {
  const match = filterStr.match(OPERATOR_ALT_REGEX);
  if (!match) {
    throw new Error(
      `Invalid filter format: "${filterStr}". Use format: dimension==value, dimension~=substr, dimension=~regex.`,
    );
  }

  const [, dimension, shorthand, expression] = match;

  if (!VALID_DIMENSIONS.includes(dimension as SearchAnalyticsDimension)) {
    throw new Error(`Unknown filter dimension: "${dimension}". Valid: ${VALID_DIMENSIONS.join(', ')}.`);
  }

  const operator = SHORTHAND_TO_GSC[shorthand];
  if (!operator) {
    throw new Error(`Unknown filter operator: ${shorthand}`);
  }

  return {
    dimension: dimension as SearchAnalyticsDimension,
    operator,
    expression,
  };
}

export function buildDimensionFilterGroup(filters: string[]): DimensionFilterGroup | undefined {
  if (!filters || filters.length === 0) return undefined;
  return {
    groupType: 'and',
    filters: filters.map(parseFilterString),
  };
}

export function buildDimensionFilterGroups(filters: string[]): DimensionFilterGroup[] | undefined {
  const group = buildDimensionFilterGroup(filters);
  return group ? [group] : undefined;
}

export function parseJsonFilterGroups(json: string): DimensionFilterGroup[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('JSON filter groups must be an array of {groupType, filters} objects.');
  }
  return parsed as DimensionFilterGroup[];
}
