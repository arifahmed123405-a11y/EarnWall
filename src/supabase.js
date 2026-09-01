import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://uajeuksurhgypsqicddr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamV1a3N1cmhneXBzcWljZGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjg5OTUsImV4cCI6MjEwMzg0NDk5NX0.3SgiiLmlj21dJaxkzuWCK6HchTM7A_3CXL2I4lmuBdk'
)
