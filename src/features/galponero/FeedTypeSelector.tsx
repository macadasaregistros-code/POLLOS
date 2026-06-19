import { Check } from 'lucide-react';
import type { TipoAlimento } from '../../types/entities';

type FeedTypeStage = 'preiniciador' | 'iniciacion' | 'engorde';

const feedTypeIds: Record<FeedTypeStage, string> = {
  preiniciador: 'alimento_preiniciador',
  iniciacion: 'alimento_iniciador',
  engorde: 'alimento_engorde',
};

const feedTypeCards: Array<{
  stage: FeedTypeStage;
  label: string;
  imageSrc: string;
  imageAlt: string;
}> = [
  {
    stage: 'preiniciador',
    label: 'preIniciador',
    imageSrc: '/feed-types/preiniciador.png',
    imageAlt: 'Bulto de alimento preIniciador',
  },
  {
    stage: 'iniciacion',
    label: 'Iniciacion',
    imageSrc: '/feed-types/iniciacion.png',
    imageAlt: 'Bulto de alimento Iniciacion',
  },
  {
    stage: 'engorde',
    label: 'Engorde',
    imageSrc: '/feed-types/engorde.png',
    imageAlt: 'Bulto de alimento Engorde',
  },
];

export interface FeedTypeOption {
  tipo: TipoAlimento;
  stage: FeedTypeStage;
  label: string;
  imageSrc: string;
  imageAlt: string;
}

function normalizeFoodText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getFoodTypeStage(tipo: TipoAlimento): FeedTypeStage | '' {
  const normalized = normalizeFoodText(`${tipo.TipoAlimentoID} ${tipo.Nombre}`);
  if (normalized.includes('preiniciador')) return 'preiniciador';
  if (normalized.includes('iniciacion') || normalized.includes('iniciador')) return 'iniciacion';
  if (normalized.includes('engorde')) return 'engorde';
  return '';
}

export function getFeedTypeOptions(tipos: TipoAlimento[]): FeedTypeOption[] {
  const activeTypes = tipos.filter((tipo) => tipo.Activo);
  return feedTypeCards
    .map((card) => {
      const tipo =
        activeTypes.find((item) => item.TipoAlimentoID === feedTypeIds[card.stage]) ??
        activeTypes.find((item) => getFoodTypeStage(item) === card.stage);
      return tipo ? { ...card, tipo } : null;
    })
    .filter((option): option is FeedTypeOption => Boolean(option));
}

export function FoodTypeSelector({
  options,
  selectedTipoId,
  onSelect,
  className = '',
}: {
  options: FeedTypeOption[];
  selectedTipoId: string;
  onSelect: (tipoId: string) => void;
  className?: string;
}) {
  return (
    <section className={`food-type-selector ${className}`} aria-labelledby="food-type-selector-label">
      <span id="food-type-selector-label">Tipo de alimento</span>
      <div className="food-type-selector__grid" role="radiogroup" aria-labelledby="food-type-selector-label">
        {options.map((option) => {
          const isSelected = option.tipo.TipoAlimentoID === selectedTipoId;
          return (
            <button
              key={option.stage}
              type="button"
              className={`food-type-option ${isSelected ? 'is-selected' : ''}`}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(option.tipo.TipoAlimentoID)}
            >
              <span className="food-type-option__image">
                <img src={option.imageSrc} alt={option.imageAlt} draggable="false" />
              </span>
              <strong>{option.label}</strong>
              {isSelected && (
                <span className="food-type-option__check" aria-hidden="true">
                  <Check size={18} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
