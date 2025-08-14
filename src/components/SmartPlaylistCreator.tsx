import { useState } from "react";
import { 
  SmartPlaylist, 
  SmartPlaylistRule, 
  SmartPlaylistField, 
  SmartPlaylistOperator, 
  SmartPlaylistLogic,
  SmartPlaylistTimeUnit 
} from "../types/music";
import { SmartPlaylistEngine } from "../utils/smartPlaylistEngine";
import { 
  Plus, 
  Trash2, 
  X, 
  Wand2, 
  Save, 
  Eye,
  Settings 
} from "lucide-react";

interface SmartPlaylistCreatorProps {
  onSave: (smartPlaylist: SmartPlaylist) => void;
  onClose: () => void;
  onPreview: (smartPlaylist: SmartPlaylist) => void;
  existingPlaylist?: SmartPlaylist;
}

export function SmartPlaylistCreator({ 
  onSave, 
  onClose, 
  onPreview, 
  existingPlaylist 
}: SmartPlaylistCreatorProps) {
  const [name, setName] = useState(existingPlaylist?.name || "");
  const [description, setDescription] = useState(existingPlaylist?.description || "");
  const [rules, setRules] = useState<SmartPlaylistRule[]>(
    existingPlaylist?.rules || [{
      id: crypto.randomUUID(),
      field: SmartPlaylistField.Artist,
      operator: SmartPlaylistOperator.Contains,
      value: ""
    }]
  );
  const [logic, setLogic] = useState<SmartPlaylistLogic>(
    existingPlaylist?.logic || SmartPlaylistLogic.And
  );
  const [limit, setLimit] = useState<number | "">(existingPlaylist?.limit || "");
  const [sortBy, setSortBy] = useState<SmartPlaylistField | "">(existingPlaylist?.sortBy || "");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(existingPlaylist?.sortOrder || "asc");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addRule = () => {
    setRules([...rules, {
      id: crypto.randomUUID(),
      field: SmartPlaylistField.Artist,
      operator: SmartPlaylistOperator.Contains,
      value: ""
    }]);
  };

  const removeRule = (ruleId: string) => {
    setRules(rules.filter(rule => rule.id !== ruleId));
  };

  const updateRule = (ruleId: string, updates: Partial<SmartPlaylistRule>) => {
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  const handleFieldChange = (ruleId: string, field: SmartPlaylistField) => {
    const operators = SmartPlaylistEngine.getOperatorOptions(field);
    updateRule(ruleId, { 
      field, 
      operator: operators[0].value,
      value: field === SmartPlaylistField.IsFavorite ? true : ""
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const smartPlaylist: SmartPlaylist = {
      id: existingPlaylist?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      rules: rules.filter(rule => rule.value !== ""),
      logic,
      limit: typeof limit === "number" ? limit : undefined,
      sortBy: sortBy || undefined,
      sortOrder,
      createdAt: existingPlaylist?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    onSave(smartPlaylist);
  };

  const handlePreview = () => {
    const smartPlaylist: SmartPlaylist = {
      id: "preview",
      name: name.trim() || "Preview",
      description,
      rules: rules.filter(rule => rule.value !== ""),
      logic,
      limit: typeof limit === "number" ? limit : undefined,
      sortBy: sortBy || undefined,
      sortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    onPreview(smartPlaylist);
  };

  const applySuggestion = (suggestion: Partial<SmartPlaylist>) => {
    setName(suggestion.name || "");
    setDescription(suggestion.description || "");
    setRules(suggestion.rules || []);
    setLogic(suggestion.logic || SmartPlaylistLogic.And);
    setShowSuggestions(false);
  };

  const needsTimeUnit = (operator: SmartPlaylistOperator) => {
    return operator === SmartPlaylistOperator.InLast || operator === SmartPlaylistOperator.NotInLast;
  };

  const fieldOptions = SmartPlaylistEngine.getFieldOptions();
  const timeUnitOptions = SmartPlaylistEngine.getTimeUnitOptions();
  const suggestions = SmartPlaylistEngine.generateSuggestedSmartPlaylists();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                {existingPlaylist ? "Edit Smart Playlist" : "Create Smart Playlist"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create automatic playlists based on your criteria
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
              >
                <Settings className="w-4 h-4" />
                Suggestions
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Suggestions Panel */}
          {showSuggestions && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/20">
              <h3 className="font-medium mb-3">Suggested Smart Playlists</h3>
              <div className="grid gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => applySuggestion(suggestion)}
                    className="text-left p-3 border rounded-md hover:bg-background transition-colors"
                  >
                    <div className="font-medium">{suggestion.name}</div>
                    <div className="text-sm text-muted-foreground">{suggestion.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">Playlist Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter playlist name..."
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Rules */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Rules</h3>
              <button
                onClick={addRule}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            {/* Logic selector */}
            {rules.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Match</label>
                <select
                  value={logic}
                  onChange={(e) => setLogic(e.target.value as SmartPlaylistLogic)}
                  className="p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value={SmartPlaylistLogic.And}>All of the following rules</option>
                  <option value={SmartPlaylistLogic.Or}>Any of the following rules</option>
                </select>
              </div>
            )}

            {/* Rules List */}
            <div className="space-y-3">
              {rules.map((rule, index) => {
                const operatorOptions = SmartPlaylistEngine.getOperatorOptions(rule.field);
                const showTimeUnit = needsTimeUnit(rule.operator);
                
                return (
                  <div key={rule.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <span className="text-sm text-muted-foreground w-8">{index + 1}</span>
                    
                    {/* Field */}
                    <select
                      value={rule.field}
                      onChange={(e) => handleFieldChange(rule.id, e.target.value as SmartPlaylistField)}
                      className="p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {fieldOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(rule.id, { operator: e.target.value as SmartPlaylistOperator })}
                      className="p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {operatorOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>

                    {/* Value */}
                    {rule.field === SmartPlaylistField.IsFavorite ? (
                      <select
                        value={String(rule.value)}
                        onChange={(e) => updateRule(rule.id, { value: e.target.value === "true" })}
                        className="p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        type={[SmartPlaylistField.Year, SmartPlaylistField.Duration, SmartPlaylistField.Rating, SmartPlaylistField.PlayCount].includes(rule.field) ? "number" : "text"}
                        value={typeof rule.value === "boolean" ? String(rule.value) : rule.value}
                        onChange={(e) => updateRule(rule.id, { value: e.target.type === "number" ? Number(e.target.value) : e.target.value })}
                        placeholder="Enter value..."
                        className="flex-1 p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    )}

                    {/* Time Unit */}
                    {showTimeUnit && (
                      <select
                        value={rule.timeUnit || SmartPlaylistTimeUnit.Days}
                        onChange={(e) => updateRule(rule.id, { timeUnit: e.target.value as SmartPlaylistTimeUnit })}
                        className="p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        {timeUnitOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    )}

                    {/* Remove Rule */}
                    <button
                      onClick={() => removeRule(rule.id)}
                      disabled={rules.length === 1}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advanced Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : "")}
                placeholder="No limit"
                min="1"
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SmartPlaylistField || "")}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">No sorting</option>
                {fieldOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                disabled={!sortBy}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {rules.filter(rule => rule.value !== "").length} rule{rules.filter(rule => rule.value !== "").length !== 1 ? 's' : ''} defined
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={rules.filter(rule => rule.value !== "").length === 0}
                className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || rules.filter(rule => rule.value !== "").length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {existingPlaylist ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}