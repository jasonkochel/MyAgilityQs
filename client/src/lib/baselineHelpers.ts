import type {
  BaselineCounts,
  CompetitionClass,
  CompetitionLevel,
} from "@my-agility-qs/shared";

export interface BaselineFormClass {
  level: string;
  qs: number | "";
  top25: number | "";
}

export interface BaselineFormValues {
  perClass: Record<string, BaselineFormClass>;
  machPoints: number | "";
  doubleQs: number | "";
}

const emptyBaselineClass = (): BaselineFormClass => ({
  level: "",
  qs: "",
  top25: "",
});

export const emptyBaselineValues = (
  classNames: readonly string[]
): BaselineFormValues => ({
  perClass: classNames.reduce((acc, className) => {
    acc[className] = emptyBaselineClass();
    return acc;
  }, {} as Record<string, BaselineFormClass>),
  machPoints: "",
  doubleQs: "",
});

export const isLevelGatedClass = (className: string): boolean =>
  className === "Standard" || className === "Jumpers" || className === "FAST";

// Convert form-state baseline values into the API's BaselineCounts shape,
// dropping empty/zero fields and ignoring classes the dog isn't in.
export const buildBaselineRequest = (
  values: BaselineFormValues,
  enabledClasses: readonly string[]
): BaselineCounts | undefined => {
  const perClass: NonNullable<BaselineCounts["perClass"]> = {};
  for (const className of enabledClasses) {
    const fields = values.perClass[className];
    if (!fields) continue;
    const qs = typeof fields.qs === "number" ? fields.qs : 0;
    const top25 = typeof fields.top25 === "number" ? fields.top25 : 0;
    const level = fields.level || undefined;
    if (qs > 0 || top25 > 0 || level) {
      perClass[className as CompetitionClass] = {
        ...(level && isLevelGatedClass(className)
          ? { level: level as CompetitionLevel }
          : {}),
        ...(qs > 0 ? { qs } : {}),
        ...(top25 > 0 ? { top25 } : {}),
      };
    }
  }
  const machPoints =
    typeof values.machPoints === "number" ? values.machPoints : 0;
  const doubleQs =
    typeof values.doubleQs === "number" ? values.doubleQs : 0;
  const baseline: BaselineCounts = {
    ...(Object.keys(perClass).length > 0 ? { perClass } : {}),
    ...(machPoints > 0 ? { machPoints } : {}),
    ...(doubleQs > 0 ? { doubleQs } : {}),
  };
  return Object.keys(baseline).length > 0 ? baseline : undefined;
};
