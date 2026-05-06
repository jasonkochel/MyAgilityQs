import { Divider, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { COMPETITION_LEVELS, isPremierClass } from "../lib/constants";
import {
  type BaselineFormClass,
  type BaselineFormValues,
  isLevelGatedClass,
} from "../lib/baselineHelpers";

interface BaselineFormProps {
  enabledClasses: string[];
  values: BaselineFormValues;
  onChange: (values: BaselineFormValues) => void;
}

export const BaselineForm: React.FC<BaselineFormProps> = ({
  enabledClasses,
  values,
  onChange,
}) => {
  const updatePerClass = (
    className: string,
    field: keyof BaselineFormClass,
    value: string | number | ""
  ) => {
    onChange({
      ...values,
      perClass: {
        ...values.perClass,
        [className]: {
          ...(values.perClass[className] ?? { level: "", qs: "", top25: "" }),
          [field]: value,
        },
      },
    });
  };

  return (
    <Stack gap="lg">
      <Stack gap="md">
        {enabledClasses.map((className) => {
          const isPremier = isPremierClass(className);
          const isLevelGated = isLevelGatedClass(className);
          const baselineLevel = values.perClass[className]?.level ?? "";
          return (
            <Stack key={className} gap={6}>
              <Text fw={600}>{className}</Text>
              <Group align="flex-end" gap="sm" grow>
                {isLevelGated && (
                  <Select
                    label="Level"
                    data={COMPETITION_LEVELS}
                    value={baselineLevel}
                    onChange={(v) => updatePerClass(className, "level", v ?? "")}
                    size="sm"
                    comboboxProps={{
                      position: "bottom-start",
                      middlewares: { flip: true, shift: true },
                    }}
                  />
                )}
                <NumberInput
                  label={isLevelGated ? "Qs at this level" : "Qs"}
                  placeholder="0"
                  min={0}
                  allowDecimal={false}
                  value={values.perClass[className]?.qs ?? ""}
                  onChange={(v) =>
                    updatePerClass(className, "qs", v === "" ? "" : Number(v))
                  }
                  size="sm"
                />
                {isPremier && (
                  <NumberInput
                    label="Top 25%"
                    placeholder="0"
                    min={0}
                    allowDecimal={false}
                    value={values.perClass[className]?.top25 ?? ""}
                    onChange={(v) =>
                      updatePerClass(
                        className,
                        "top25",
                        v === "" ? "" : Number(v)
                      )
                    }
                    size="sm"
                  />
                )}
              </Group>
            </Stack>
          );
        })}
      </Stack>

      <Divider />

      <Stack gap={6}>
        <Text fw={600}>Career totals</Text>
        <Group gap="sm" grow>
          <NumberInput
            label="Double Qs"
            placeholder="0"
            min={0}
            allowDecimal={false}
            value={values.doubleQs}
            onChange={(v) =>
              onChange({
                ...values,
                doubleQs: v === "" ? "" : Number(v),
              })
            }
            size="sm"
          />
          <NumberInput
            label="MACH Points"
            placeholder="0"
            min={0}
            allowDecimal={false}
            value={values.machPoints}
            onChange={(v) =>
              onChange({
                ...values,
                machPoints: v === "" ? "" : Number(v),
              })
            }
            size="sm"
          />
        </Group>
      </Stack>
    </Stack>
  );
};
