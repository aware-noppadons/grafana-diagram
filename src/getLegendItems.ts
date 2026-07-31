import { LinkModel } from '@grafana/data';
import { VizLegendItem } from '@grafana/ui';
import { getSeriesLinks } from './visualizers/diagramLinks';
import { DiagramSeriesModel, DiagramSeriesValue, LegendOptions } from './config/types';

const shouldHideLegendItem = (data: DiagramSeriesValue[][], hideEmpty = false, hideZero = false) => {
  const isZeroOnlySeries = data.reduce((acc, current) => acc + (current[1] || 0), 0) === 0;
  const isNullOnlySeries = !data.reduce((acc, current) => acc && current[1] !== null, true);

  return (hideEmpty && isNullOnlySeries) || (hideZero && isZeroOnlySeries);
};

/**
 * Project the series models onto legend items, carrying each series' data links so a click on
 * the label can follow them (VizLegend renders labels as buttons, not anchors).
 */
export const getLegendItems = (
  models: DiagramSeriesModel[],
  legend: LegendOptions
): Array<VizLegendItem<LinkModel[]>> => {
  const { stats } = legend;
  return models.reduce<Array<VizLegendItem<LinkModel[]>>>((acc, s) => {
    if (shouldHideLegendItem(s.data, legend.hideEmpty, legend.hideZero)) {
      return acc;
    }
    const displayValue = s.info?.find((dv) => dv.title === s.valueField?.config?.custom?.valueName);
    return acc.concat([
      {
        label: s.label,
        color: '',
        disabled: !s.isVisible,
        yAxis: 0,
        data: getSeriesLinks(s, displayValue),
        getDisplayValues: () => {
          const info = s.info || [];
          return stats && stats.length > 0 ? info.filter((dv) => stats.includes(dv.title as string)) : info;
        },
      },
    ]);
  }, []);
};
