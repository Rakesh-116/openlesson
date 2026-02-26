-- Allow authenticated users to read all profile usernames (for community plans)
CREATE POLICY "Authenticated users can view all usernames"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);