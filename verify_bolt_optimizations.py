import unittest
from unittest.mock import MagicMock, patch, ANY
import json
import requests

# Import the optimized scripts
import check_map_seat
import count_remain_seat

class TestBoltOptimizations(unittest.TestCase):

    @patch('requests.Session')
    def test_check_map_seat_session_reuse(self, MockSession):
        # Setup mock session and responses
        mock_session = MockSession.return_value
        mock_session.__enter__.return_value = mock_session

        # Mock get_block_list response
        mock_block_response = MagicMock()
        mock_block_response.text = '/**/getBlockGradeSeatMapCallBack({"seatData":{"da":{"sb":[{"sbid":"1","sntv":{"a":"A"}}]}}});'

        # Mock get_remain_seat_in_block response
        mock_seat_response = MagicMock()
        mock_seat_response.text = '/**/getSeatListCallBack({"seatData":{"st":[{"ss":[{"sid":"101"}]}]}});'

        # Mock slack response
        mock_slack_response = MagicMock()

        # 1 for blocks, then 2 iterations of (1 seat check + 1 slack message)
        mock_session.post.side_effect = [
            mock_block_response,
            mock_seat_response, mock_slack_response,
            mock_seat_response, mock_slack_response
        ]

        # Patch time.sleep to speed up test
        with patch('time.sleep', return_value=None):
            # Run for 2 iterations to prove get_block_list is only called once
            with patch('check_map_seat.range', return_value=range(2)):
                check_map_seat.main()

        # Verify get_block_list was called once
        # Total calls: 1 (blocks) + 2 (iterations) * (1 (seats) + 1 (slack)) = 5
        self.assertEqual(mock_session.post.call_count, 5)

        # Verify first call was for getAreaMap
        args, kwargs = mock_session.post.call_args_list[0]
        self.assertIn('getAreaMap.json', args[0])

    @patch('requests.Session')
    def test_count_remain_seat_session_reuse(self, MockSession):
        # Setup mock session and responses
        mock_session = MockSession.return_value
        mock_session.__enter__.return_value = mock_session

        # Mock get_seats_summary response
        mock_summary_response = MagicMock()
        mock_summary_response.json.return_value = {"summary": [{"realSeatCntlk": 1, "areaName": "A"}]}

        # Mock slack response
        mock_slack_response = MagicMock()

        mock_session.post.side_effect = [mock_summary_response, mock_slack_response]

        with patch('time.sleep', return_value=None):
            with patch('count_remain_seat.range', return_value=range(1)):
                count_remain_seat.main()

        # Verify session.post was used
        self.assertEqual(mock_session.post.call_count, 2) # 1 for summary, 1 for slack

        # Verify first call was for summary.json
        args, kwargs = mock_session.post.call_args_list[0]
        self.assertIn('summary.json', args[0])

if __name__ == '__main__':
    unittest.main()
