-- Allow authenticated users to read all profile usernames (for community plans)
CREATE POLICY "Authenticated users can view all usernames"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert learning plans
CREATE POLICY "Users can create learning plans"
  ON learning_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);