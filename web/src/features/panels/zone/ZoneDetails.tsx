import useGetZone from 'api/getZone';
import { Button } from 'components/Button';
import LoadingSpinner from 'components/LoadingSpinner';
import BarBreakdownChart from 'features/charts/bar-breakdown/BarBreakdownChart';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdOutlineCloudDownload } from 'react-icons/md';
import { Navigate, useParams } from 'react-router-dom';
import { ZoneMessage } from 'types';
import { SpatialAggregate, TimeAverages } from 'utils/constants';
import {
  displayByEmissionsAtom,
  selectedDatetimeIndexAtom,
  spatialAggregateAtom,
  timeAverageAtom,
} from 'utils/state/atoms';
import { useBreakpoint } from 'utils/styling';

import AreaGraphContainer from './AreaGraphContainer';
import Attribution from './Attribution';
import DisplayByEmissionToggle from './DisplayByEmissionToggle';
import EstimationCard from './EstimationCard';
import NoInformationMessage from './NoInformationMessage';
import { getHasSubZones, getZoneDataStatus, ZoneDataStatus } from './util';
import { ZoneHeaderGauges } from './ZoneHeaderGauges';
import ZoneHeaderTitle from './ZoneHeaderTitle';

export default function ZoneDetails(): JSX.Element {
  const { zoneId } = useParams();
  const [timeAverage] = useAtom(timeAverageAtom);
  const [displayByEmissions] = useAtom(displayByEmissionsAtom);
  const [_, setViewMode] = useAtom(spatialAggregateAtom);
  const [selectedDatetime] = useAtom(selectedDatetimeIndexAtom);
  const { data, isError, isLoading } = useGetZone();
  const { t } = useTranslation();
  const isMobile = !useBreakpoint('sm');

  const hasSubZones = getHasSubZones(zoneId);
  const isSubZone = zoneId ? zoneId.includes('-') : true;

  useEffect(() => {
    if (hasSubZones === null) {
      return;
    }
    // When first hitting the map (or opening a zone from the ranking panel),
    // set the correct matching view mode (zone or country).
    if (hasSubZones && !isSubZone) {
      setViewMode(SpatialAggregate.COUNTRY);
    }
    if (!hasSubZones && isSubZone) {
      setViewMode(SpatialAggregate.ZONE);
    }
  }, [hasSubZones, isSubZone, setViewMode]);

  if (!zoneId) {
    return <Navigate to="/" replace />;
  }

  // TODO: App-backend should not return an empty array as "data" if the zone does not
  // exist.
  if (Array.isArray(data)) {
    return <Navigate to="/" replace />;
  }

  const zoneDataStatus = getZoneDataStatus(zoneId, data, timeAverage);

  const datetimes = Object.keys(data?.zoneStates || {})?.map((key) => new Date(key));

  const selectedData = data?.zoneStates[selectedDatetime.datetimeString];
  const { estimationMethod, estimatedPercentage } = selectedData || {};
  const zoneMessage = data?.zoneMessage;
  const cardType = getCardType({ estimationMethod, zoneMessage, timeAverage });
  const hasEstimationPill = Boolean(estimationMethod) || Boolean(estimatedPercentage);

  return (
    <>
      <ZoneHeaderTitle zoneId={zoneId} />
      <div className="h-[calc(100%-110px)] overflow-y-scroll p-3 pb-40 pt-2 sm:h-[calc(100%-130px)]">
        {cardType != 'none' &&
          zoneDataStatus !== ZoneDataStatus.NO_INFORMATION &&
          zoneDataStatus !== ZoneDataStatus.AGGREGATE_DISABLED && (
            <EstimationCard
              cardType={cardType}
              estimationMethod={estimationMethod}
              zoneMessage={zoneMessage}
              estimatedPercentage={selectedData?.estimatedPercentage}
            />
          )}
        <ZoneHeaderGauges data={data} />
        {zoneDataStatus !== ZoneDataStatus.NO_INFORMATION &&
          zoneDataStatus !== ZoneDataStatus.AGGREGATE_DISABLED && (
            <DisplayByEmissionToggle />
          )}
        <ZoneDetailsContent
          isLoading={isLoading}
          isError={isError}
          zoneDataStatus={zoneDataStatus}
        >
          <BarBreakdownChart hasEstimationPill={hasEstimationPill} />
          <Button
            backgroundClasses="mt-3 mb-1"
            size="lg"
            type="link"
            icon={<MdOutlineCloudDownload size={20} />}
            href="https://electricitymaps.com/?utm_source=app.electricitymaps.com&utm_medium=referral&utm_campaign=country_panel"
          >
            {t('left-panel.get-data')}
          </Button>
          {zoneDataStatus === ZoneDataStatus.AVAILABLE && (
            <AreaGraphContainer
              datetimes={datetimes}
              timeAverage={timeAverage}
              displayByEmissions={displayByEmissions}
            />
          )}
          <Attribution zoneId={zoneId} />
          {isMobile ? (
            <Button
              backgroundClasses="mt-3"
              icon={<MdOutlineCloudDownload size={20} />}
              href="https://electricitymaps.com/?utm_source=app.electricitymaps.com&utm_medium=referral&utm_campaign=country_panel"
            >
              {t('header.get-data')}
            </Button>
          ) : (
            <div className="p-2" />
          )}
        </ZoneDetailsContent>
      </div>
    </>
  );
}

function getCardType({
  estimationMethod,
  zoneMessage,
  timeAverage,
}: {
  estimationMethod: string | undefined;
  zoneMessage?: ZoneMessage;
  timeAverage: TimeAverages;
}): 'estimated' | 'aggregated' | 'outage' | 'none' {
  if (
    (zoneMessage !== undefined &&
      zoneMessage?.message !== undefined &&
      zoneMessage?.issue !== undefined) ||
    estimationMethod === 'threshold_filtered'
  ) {
    return 'outage';
  }
  if (timeAverage !== TimeAverages.HOURLY) {
    return 'aggregated';
  }
  if (estimationMethod) {
    return 'estimated';
  }
  return 'none';
}

function ZoneDetailsContent({
  isLoading,
  isError,
  children,
  zoneDataStatus,
}: {
  isLoading: boolean;
  isError: boolean;
  children: React.ReactNode;
  zoneDataStatus: ZoneDataStatus;
}): JSX.Element {
  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <div
        data-test-id="no-parser-message"
        className={`flex h-full w-full items-center justify-center text-sm`}
      >
        🤖 Unknown server error 🤖
      </div>
    );
  }

  if (
    [ZoneDataStatus.NO_INFORMATION, ZoneDataStatus.AGGREGATE_DISABLED].includes(
      zoneDataStatus
    )
  ) {
    return <NoInformationMessage status={zoneDataStatus} />;
  }

  return children as JSX.Element;
}
