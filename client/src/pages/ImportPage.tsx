import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Progress,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CompetitionClass, CompetitionLevel, CreateRunRequest } from "@my-agility-qs/shared";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { dogsApi, runsApi } from "../lib/api";

// Import data types
interface ImportRow {
  dog: string;
  date: string;
  level: string;
  class: string;
  rowNumber: number;
  errors: string[];
  parsed?: {
    dogId: string;
    date: string;
    level: CompetitionLevel;
    class: CompetitionClass;
  };
}

interface ImportStats {
  total: number;
  valid: number;
  errors: number;
  imported: number;
}

export const ImportPage: React.FC = () => {
  const [, setLocation] = useLocation();

  // Import feature state
  const [importText, setImportText] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importStats, setImportStats] = useState<ImportStats>({
    total: 0,
    valid: 0,
    errors: 0,
    imported: 0,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch user's dogs for import validation
  const { data: dogs = [] } = useQuery({
    queryKey: ["dogs"],
    queryFn: dogsApi.getAllDogs,
  });

  // Parse and validate import data
  const parseImportData = useCallback(
    (text: string): ImportRow[] => {
      const lines = text.trim().split("\n");
      if (lines.length < 2) return [];

      // Skip header row
      const dataLines = lines.slice(1);
      const validLevels = ["Novice", "Open", "Excellent", "Masters"];
      const validClasses = [
        "Standard",
        "Jumpers",
        "T2B",
        "FAST",
        "Premier Std",
        "Premier JWW",
        "JWW",
        "Std",
      ];

      return dataLines.map((line, index) => {
        const rowNumber = index + 2; // +2 because we skip header and use 1-based indexing
        const columns = line.split("\t");
        const errors: string[] = [];

        if (columns.length !== 4) {
          errors.push(`Expected 4 columns, found ${columns.length}`);
        }

        const [dogName = "", dateStr = "", level = "", className = ""] = columns.map((col) =>
          col.trim()
        );

        // Validate dog name
        if (!dogName) {
          errors.push("Dog name is required");
        }

        // Find matching dog
        const matchingDog = dogs.find((dog) => dog.name.toLowerCase() === dogName.toLowerCase());
        if (dogName && !matchingDog) {
          errors.push(`Dog "${dogName}" not found in your dogs`);
        }

        // Validate and parse date
        let parsedDate = "";
        if (!dateStr) {
          errors.push("Date is required");
        } else {
          const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (!dateMatch) {
            errors.push("Date must be in M/D/YYYY format");
          } else {
            const [, month, day, year] = dateMatch;
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (
              date.getFullYear() != parseInt(year) ||
              date.getMonth() != parseInt(month) - 1 ||
              date.getDate() != parseInt(day)
            ) {
              errors.push("Invalid date");
            } else {
              parsedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD
            }
          }
        }

        // Validate level
        if (!level) {
          errors.push("Level is required");
        } else if (!validLevels.includes(level)) {
          errors.push(`Invalid level "${level}". Must be one of: ${validLevels.join(", ")}`);
        }

        // Validate and normalize class name
        let normalizedClass = className;
        if (!className) {
          errors.push("Class is required");
        } else {
          // Handle common abbreviations
          const classMap: Record<string, string> = {
            JWW: "Jumpers",
            Std: "Standard",
            "Premier JWW": "Premier JWW",
            "Premier Std": "Premier Std",
          };

          normalizedClass = classMap[className] || className;

          if (!validClasses.includes(normalizedClass)) {
            errors.push(`Invalid class "${className}". Must be one of: ${validClasses.join(", ")}`);
          }
        }

        const row: ImportRow = {
          dog: dogName,
          date: dateStr,
          level,
          class: className,
          rowNumber,
          errors,
        };

        // Add parsed data if no errors
        if (errors.length === 0 && matchingDog) {
          row.parsed = {
            dogId: matchingDog.id,
            date: parsedDate,
            level: level as CompetitionLevel,
            class: normalizedClass as CompetitionClass,
          };
        }

        return row;
      });
    },
    [dogs]
  );

  // Handle text change and parse data
  const handleImportTextChange = useCallback(
    (text: string) => {
      setImportText(text);

      if (!text.trim()) {
        setImportRows([]);
        setImportStats({ total: 0, valid: 0, errors: 0, imported: 0 });
        setShowPreview(false);
        return;
      }

      const rows = parseImportData(text);
      setImportRows(rows);

      const stats = {
        total: rows.length,
        valid: rows.filter((row) => row.errors.length === 0).length,
        errors: rows.filter((row) => row.errors.length > 0).length,
        imported: 0,
      };
      setImportStats(stats);
      setShowPreview(rows.length > 0);
    },
    [parseImportData]
  );

  // Import runs
  const handleImportRuns = useCallback(async () => {
    const validRows = importRows.filter((row) => row.errors.length === 0 && row.parsed);
    if (validRows.length === 0) return;

    setIsImporting(true);
    let imported = 0;

    try {
      for (const row of validRows) {
        if (!row.parsed) continue;

        const runData: CreateRunRequest = {
          dogId: row.parsed.dogId,
          date: row.parsed.date,
          level: row.parsed.level,
          class: row.parsed.class,
          qualified: false, // Default to false, user can edit later
        };

        try {
          await runsApi.createRun(runData);
          imported++;
          setImportStats((prev) => ({ ...prev, imported }));
        } catch {
          console.error(`Failed to import row ${row.rowNumber}`);
          // Continue with other rows
        }
      }

      notifications.show({
        title: "Import Complete",
        message: `Successfully imported ${imported} of ${validRows.length} runs`,
        color: imported === validRows.length ? "green" : "yellow",
      });

      if (imported === validRows.length) {
        // Clear the form on successful import
        setImportText("");
        setImportRows([]);
        setShowPreview(false);
        setImportStats({ total: 0, valid: 0, errors: 0, imported: 0 });
      }
    } catch {
      notifications.show({
        title: "Import Error",
        message: "Failed to import runs. Please try again.",
        color: "red",
      });
    } finally {
      setIsImporting(false);
    }
  }, [importRows]);

  return (
    <Container size="md" py="md">
      <Stack>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => setLocation("/profile")}
          w="fit-content"
        >
          Back to Profile
        </Button>

        <Title order={1}>Import Runs</Title>

        <Alert icon={<IconAlertTriangle size={16} />} title="Import Format" color="blue">
          <Text size="sm">
            Paste tab-separated data with columns: <strong>Dog, Date, Level, Class</strong>
            <br />
            Example: Luna 9/18/2022 Novice JWW
            <br />
            • Date format: M/D/YYYY
            <br />
            • Dog names must match existing dogs in your account
            <br />• All imported runs will be marked as non-qualifying by default (you can edit them
            later)
          </Text>
        </Alert>

        <Textarea
          label="Paste your data here"
          description="Tab-separated values with header row"
          placeholder="Dog	Date	Level	Class
Luna	9/18/2022	Novice	JWW
Luna	6/17/2023	Novice	JWW
Piper	5/9/2021	Novice	Std"
          value={importText}
          onChange={(event) => handleImportTextChange(event.currentTarget.value)}
          minRows={6}
          maxRows={15}
          size="md"
        />

        {showPreview && (
          <Stack gap="md">
            <Group gap="md">
              <Badge color="blue" variant="light" size="lg">
                Total: {importStats.total}
              </Badge>
              <Badge color="green" variant="light" size="lg">
                Valid: {importStats.valid}
              </Badge>
              {importStats.errors > 0 && (
                <Badge color="red" variant="light" size="lg">
                  Errors: {importStats.errors}
                </Badge>
              )}
              {importStats.imported > 0 && (
                <Badge color="teal" variant="light" size="lg">
                  Imported: {importStats.imported}
                </Badge>
              )}
            </Group>

            {isImporting && (
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  Importing... {importStats.imported}/{importStats.valid}
                </Text>
                <Progress value={(importStats.imported / importStats.valid) * 100} />
              </Stack>
            )}

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Row</Table.Th>
                  <Table.Th>Dog</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Class</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {importRows.map((row) => (
                  <Table.Tr key={row.rowNumber}>
                    <Table.Td>{row.rowNumber}</Table.Td>
                    <Table.Td>{row.dog}</Table.Td>
                    <Table.Td>{row.date}</Table.Td>
                    <Table.Td>{row.level}</Table.Td>
                    <Table.Td>{row.class}</Table.Td>
                    <Table.Td>
                      {row.errors.length === 0 ? (
                        <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
                          Valid
                        </Badge>
                      ) : (
                        <Badge color="red" variant="light" leftSection={<IconX size={12} />}>
                          {row.errors.length} error{row.errors.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {row.errors.length > 0 && (
                        <Text size="xs" c="red" mt={2}>
                          {row.errors.join(", ")}
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {importStats.valid > 0 && (
              <Group justify="center">
                <Button
                  color="green"
                  size="lg"
                  leftSection={<IconUpload size={20} />}
                  onClick={handleImportRuns}
                  loading={isImporting}
                  disabled={importStats.valid === 0}
                >
                  Import {importStats.valid} Run{importStats.valid > 1 ? "s" : ""}
                </Button>
              </Group>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
};
