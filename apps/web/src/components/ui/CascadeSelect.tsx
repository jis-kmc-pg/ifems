import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { getFactoryList, getLineList, getFacilityMasterList, type Factory, type Line, type Facility } from '../../services/settings';

interface CascadeSelectProps {
  value: string; // selected facilityId
  onChange: (facilityId: string) => void;
  label?: React.ReactNode;
  placeholder?: string;
  className?: string;
}

export default function CascadeSelect({ value, onChange, label, placeholder, className = '' }: CascadeSelectProps) {
  const [factories, setFactories] = useState<Factory[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [selectedFactory, setSelectedFactory] = useState<string>('');
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [selectedFacility, setSelectedFacility] = useState<string>(value);

  // Load factories on mount
  useEffect(() => {
    getFactoryList()
      .then(setFactories)
      .catch((error) => console.error('Failed to load factories:', error));
  }, []);

  // Load lines when factory is selected
  useEffect(() => {
    if (selectedFactory) {
      getLineList(selectedFactory)
        .then(setLines)
        .catch((error) => console.error('Failed to load lines:', error));
    } else {
      setLines([]);
      setSelectedLine('');
    }
  }, [selectedFactory]);

  // Load facilities when line is selected
  useEffect(() => {
    if (selectedLine) {
      getFacilityMasterList()
        .then((allFacilities) => {
          // Filter facilities by selected line
          const filtered = allFacilities.filter((f) => f.lineId === selectedLine);
          setFacilities(filtered);
        })
        .catch((error) => console.error('Failed to load facilities:', error));
    } else {
      setFacilities([]);
      setSelectedFacility('');
    }
  }, [selectedLine]);

  // Sync external value changes
  useEffect(() => {
    if (value && value !== selectedFacility) {
      // Find the facility and set hierarchy
      getFacilityMasterList()
        .then((allFacilities) => {
          const facility = allFacilities.find((f) => f.id === value);
          if (facility) {
            setSelectedFacility(value);
            setSelectedLine(facility.lineId);
            // Find factory from line
            getLineList().then((allLines) => {
              const line = allLines.find((l) => l.id === facility.lineId);
              if (line) {
                setSelectedFactory(line.factoryId);
              }
            });
          }
        })
        .catch((error) => console.error('Failed to sync value:', error));
    }
  }, [value]);

  const handleFactoryChange = (factoryId: string) => {
    setSelectedFactory(factoryId);
    setSelectedLine('');
    setSelectedFacility('');
    onChange('');
  };

  const handleLineChange = (lineId: string) => {
    setSelectedLine(lineId);
    setSelectedFacility('');
    onChange('');
  };

  const handleFacilityChange = (facilityId: string) => {
    setSelectedFacility(facilityId);
    onChange(facilityId);
  };

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}

      <div className="grid grid-cols-3 gap-3">
        {/* Factory Select */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">공장 (Factory)</label>
          <select
            value={selectedFactory}
            onChange={(e) => handleFactoryChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
          >
            <option value="">공장 선택</option>
            {factories.map((factory) => (
              <option key={factory.id} value={factory.id}>
                {factory.name}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="flex items-end pb-2">
          <ChevronRight size={20} className="text-gray-500" />
        </div>

        {/* Line Select */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">라인 (Line)</label>
          <select
            value={selectedLine}
            onChange={(e) => handleLineChange(e.target.value)}
            disabled={!selectedFactory}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">라인 선택</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="flex items-end pb-2">
          <ChevronRight size={20} className="text-gray-500" />
        </div>

        {/* Facility Select */}
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">설비 (Facility)</label>
          <select
            value={selectedFacility}
            onChange={(e) => handleFacilityChange(e.target.value)}
            disabled={!selectedLine}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">{placeholder || '설비 선택'}</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.code} - {facility.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
