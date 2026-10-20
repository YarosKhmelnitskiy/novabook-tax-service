import { Transform } from 'class-transformer';
import { ValidateBy, ValidationArguments, ValidationOptions } from 'class-validator';
import { TaxRate } from '../../domain/TaxRate';
import { looksLikeUnencodedPlus, parseIsoInstant } from './isoInstant';

export function IsIsoInstant(options?: ValidationOptions): PropertyDecorator {
  const toInstant = Transform(({ value }) => parseIsoInstant(value) ?? value);
  const validate = ValidateBy(
    {
      name: 'isIsoInstant',
      validator: {
        validate: (value: unknown): boolean => value instanceof Date,
        defaultMessage: (args?: ValidationArguments): string => {
          const property = args?.property ?? 'date';
          const hint = looksLikeUnencodedPlus(args?.value)
            ? '; a "+" in a query string must be encoded as %2B, otherwise it arrives as a space'
            : '';
          return `${property} must be an ISO 8601 date-time with a time zone, e.g. 2024-02-22T17:29:39Z${hint}`;
        },
      },
    },
    options,
  );
  return (target, propertyKey) => {
    toInstant(target, propertyKey);
    validate(target, propertyKey);
  };
}

export function IsPence(minimum: number, options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isPence',
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum,
        defaultMessage: (args?: ValidationArguments): string =>
          `${args?.property ?? 'value'} must be a whole number of pence, at least ${minimum} and at most ${Number.MAX_SAFE_INTEGER}`,
      },
    },
    options,
  );
}

export function IsTaxRate(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isTaxRate',
      validator: {
        validate: (value: unknown): boolean => TaxRate.isValidFraction(value),
        defaultMessage: (args?: ValidationArguments): string =>
          `${args?.property ?? 'taxRate'} must be a number between 0 and 1 with at most 9 decimal places, e.g. 0.2 for 20%`,
      },
    },
    options,
  );
}

export function HasUniqueItemIds(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'hasUniqueItemIds',
      validator: {
        validate: (value: unknown): boolean => {
          if (!Array.isArray(value)) {
            return true;
          }
          const itemIds = value.map((item: unknown) =>
            typeof item === 'object' && item !== null ? (item as { itemId?: unknown }).itemId : undefined,
          );
          return new Set(itemIds).size === itemIds.length;
        },
        defaultMessage: (): string => 'items must not repeat an itemId within one sale',
      },
    },
    options,
  );
}
