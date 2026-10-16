import { Check, Cpu, Eye, Terminal } from "lucide-react";
import type { AgentType } from "@/types";

export function AgentPicker({
  value,
  onChange,
  disabled = false,
  label = "Choose an agent",
  agents,
}: {
  value: AgentType;
  onChange: (value: AgentType) => void;
  disabled?: boolean;
  label?: string;
  agents?: readonly AgentType[];
}) {
  const availableAgents: readonly AgentType[] =
    agents ||
    (value === "ocr" ? (["ocr"] as const) : (["codex", "claude"] as const));

  return (
    <fieldset className="field-group" disabled={disabled}>
      <legend className="field-label">{label}</legend>
      <div className="agent-picker">
        {availableAgents.map((agent) => (
          <label
            className="agent-option"
            data-agent={agent}
            data-selected={value === agent}
            key={agent}
          >
            <input
              type="radio"
              name={label}
              value={agent}
              checked={value === agent}
              onChange={() => onChange(agent)}
            />
            <span className="agent-option-icon">
              {agent === "codex" ? (
                <Terminal size={20} />
              ) : agent === "claude" ? (
                <Cpu size={20} />
              ) : (
                <Eye size={20} />
              )}
            </span>
            <span>
              <strong>
                {agent === "codex"
                  ? "Codex"
                  : agent === "claude"
                    ? "Claude Code"
                    : "OpenCodeReview"}
              </strong>
              <small>
                {agent === "codex"
                  ? "OpenAI"
                  : agent === "claude"
                    ? "Anthropic"
                    : "Alibaba OCR (Luna)"}
              </small>
            </span>
            {value === agent && (
              <Check size={16} className="agent-option-check" />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
