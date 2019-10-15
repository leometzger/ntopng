--
-- (C) 2019 - ntop.org
--

local alert_consts = require("alert_consts")

-- #################################################################

return {
  status_id = 26,
  relevance = 20,
  prio = 670,
  severity = alert_consts.alert_severities.error,
  alert_type = alert_consts.alert_types.potentially_dangerous_protocol,
  i18n_title = "flow_details.potentially_dangerous_protocol"
}