# @niubu/plugins

Private version 0.1.0 workspace source package. Consumers use only the explicit exports in package.json.

Only ./chart and ./csv are public; there is no root barrel. ./chart exports default/named MetricChart and ChartContainer/ChartConfig, with its existing chart CSS. App consumers load ./chart lazily. ./csv exports pure parseCsv(text) object rows/string errors and parseCsvRecords(text) raw headers/records/structured parser errors. The parser does not rename headers, normalize cells or enforce domain rules. Both interfaces share one parse implementation.
