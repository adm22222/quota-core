SELECT 'negative account usage' AS violation, account_id::text AS key
FROM account_monthly_usage WHERE consumed < 0
UNION ALL
SELECT 'negative user usage', user_id::text || ':' || month::text
FROM user_monthly_usage WHERE consumed < 0
UNION ALL
SELECT 'accepted request without usage snapshot', id::text
FROM consumption_requests WHERE outcome = 'ACCEPTED' AND limits_snapshot IS NULL
UNION ALL
SELECT 'unfinished request', id::text
FROM consumption_requests WHERE outcome IS NULL
UNION ALL
SELECT 'account usage does not match accepted requests', u.account_id::text || ':' || u.month::text
FROM account_monthly_usage u
LEFT JOIN (
  SELECT account_id, month, COALESCE(SUM(units), 0) AS consumed
  FROM consumption_requests WHERE outcome = 'ACCEPTED'
  GROUP BY account_id, month
) r ON r.account_id = u.account_id AND r.month = u.month
WHERE u.consumed <> COALESCE(r.consumed, 0)
UNION ALL
SELECT 'user usage does not match accepted requests', u.user_id::text || ':' || u.month::text
FROM user_monthly_usage u
LEFT JOIN (
  SELECT user_id, month, COALESCE(SUM(units), 0) AS consumed
  FROM consumption_requests WHERE outcome = 'ACCEPTED'
  GROUP BY user_id, month
) r ON r.user_id = u.user_id AND r.month = u.month
WHERE u.consumed <> COALESCE(r.consumed, 0);
